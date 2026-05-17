import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, statSync, unlinkSync } from 'fs';
import path from 'path';
import crypto from 'crypto';

const execAsync = promisify(exec);

// Max allowed file size: 200 MB
const MAX_BYTES = 200 * 1024 * 1024;

// Minimum valid file size: anything under 100 KB is a partial/corrupt download
const MIN_VALID_BYTES = 100 * 1024;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let fbUrl: string;
  try {
    const body = await req.json();
    fbUrl = body.url;
    new URL(fbUrl);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  const host = new URL(fbUrl).hostname.replace('www.', '');
  if (!['facebook.com', 'm.facebook.com', 'fb.watch'].includes(host)) {
    return NextResponse.json({ error: 'Not a Facebook URL' }, { status: 400 });
  }

  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

  const hash = crypto.createHash('sha256').update(fbUrl).digest('hex').slice(0, 16);
  const outPath = path.join(uploadsDir, `fb_${hash}.mp4`);
  const publicPath = `/uploads/fb_${hash}.mp4`;

  // Delete any existing partial/corrupt file before checking cache
  if (existsSync(outPath)) {
    const { size } = statSync(outPath);
    if (size < MIN_VALID_BYTES) {
      console.warn(`[fetch-facebook] Removing corrupt/partial file (${size} bytes): ${outPath}`);
      unlinkSync(outPath);
    } else {
      return NextResponse.json({ url: publicPath });
    }
  }

  try {
    // Format priority:
    // 1. Best H.264 video + AAC audio (natively supported by all browsers)
    // 2. Any mp4 with H.264
    // 3. Any available format — then ffmpeg re-encodes to H.264/AAC via --recode-video
    // --postprocessor-args forces ffmpeg to re-encode non-H.264 streams
    const cmd = [
      'yt-dlp',
      '--no-playlist',
      '--max-filesize', String(MAX_BYTES),
      '-f', '"bestvideo[vcodec^=avc][ext=mp4]+bestaudio[acodec^=mp4a]/bestvideo[vcodec^=avc]+bestaudio/best[vcodec^=avc]/best"',
      '--merge-output-format', 'mp4',
      '--recode-video', 'mp4',
      '--postprocessor-args', '"ffmpeg:-vcodec libx264 -acodec aac -movflags +faststart"',
      '--no-warnings',
      '-o', `"${outPath}"`,
      '--',
      `"${fbUrl}"`,
    ].join(' ');

    await execAsync(cmd, { timeout: 180_000 }); // 3 min timeout (re-encoding takes longer)

    if (!existsSync(outPath) || statSync(outPath).size < MIN_VALID_BYTES) {
      if (existsSync(outPath)) unlinkSync(outPath);
      return NextResponse.json(
        { error: 'Download produced an empty or corrupt file.' },
        { status: 422 }
      );
    }

    return NextResponse.json({ url: publicPath });
  } catch (err: any) {
    if (existsSync(outPath)) {
      try { unlinkSync(outPath); } catch { /* ignore */ }
    }
    console.error('[fetch-facebook] yt-dlp error:', err?.stderr ?? err?.message ?? err);
    return NextResponse.json(
      { error: 'Could not download video. It may be private or unavailable.' },
      { status: 422 }
    );
  }
}
