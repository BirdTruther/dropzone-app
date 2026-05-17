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
  // Must be authenticated
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let fbUrl: string;
  try {
    const body = await req.json();
    fbUrl = body.url;
    new URL(fbUrl); // validate
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  // Only allow Facebook/fb.watch URLs
  const host = new URL(fbUrl).hostname.replace('www.', '');
  if (!['facebook.com', 'm.facebook.com', 'fb.watch'].includes(host)) {
    return NextResponse.json({ error: 'Not a Facebook URL' }, { status: 400 });
  }

  // Ensure uploads directory exists
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

  // Unique filename based on URL hash
  const hash = crypto.createHash('sha256').update(fbUrl).digest('hex').slice(0, 16);
  const outPath = path.join(uploadsDir, `fb_${hash}.mp4`);
  const publicPath = `/uploads/fb_${hash}.mp4`;

  // FIX 2: Delete any existing file that is too small (partial / corrupt download)
  if (existsSync(outPath)) {
    const { size } = statSync(outPath);
    if (size < MIN_VALID_BYTES) {
      console.warn(`[fetch-facebook] Removing corrupt/partial file (${size} bytes): ${outPath}`);
      unlinkSync(outPath);
    } else {
      // Healthy cached file — return immediately
      return NextResponse.json({ url: publicPath });
    }
  }

  try {
    // yt-dlp: best mp4 quality, hard cap at 200MB, output to specific file
    const cmd = [
      'yt-dlp',
      '--no-playlist',
      '--max-filesize', String(MAX_BYTES),
      '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      '--merge-output-format', 'mp4',
      '--no-warnings',
      '-o', outPath,
      '--', // prevent URL from being interpreted as a flag
      JSON.stringify(fbUrl),
    ].join(' ');

    await execAsync(cmd, { timeout: 120_000 }); // 2 min timeout

    // Verify the output file is a healthy size before returning
    if (!existsSync(outPath) || statSync(outPath).size < MIN_VALID_BYTES) {
      if (existsSync(outPath)) unlinkSync(outPath); // clean up
      return NextResponse.json(
        { error: 'Download produced an empty or corrupt file.' },
        { status: 422 }
      );
    }

    return NextResponse.json({ url: publicPath });
  } catch (err: any) {
    // Clean up any partial file left by a failed/killed yt-dlp process
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
