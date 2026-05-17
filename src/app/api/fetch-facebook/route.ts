import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, statSync, unlinkSync } from 'fs';
import path from 'path';
import crypto from 'crypto';

const execFileAsync = promisify(execFile);

const MAX_BYTES = 200 * 1024 * 1024; // 200 MB
const MIN_VALID_BYTES = 100 * 1024;  // 100 KB

/** Use ffprobe to confirm the file is a real, playable video. */
async function isValidVideo(filePath: string): Promise<boolean> {
  try {
    await execFileAsync('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=codec_name',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath,
    ], { timeout: 15_000 });
    return true;
  } catch {
    return false;
  }
}

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

  // Delete partial/corrupt cached file
  if (existsSync(outPath)) {
    const { size } = statSync(outPath);
    const valid = size >= MIN_VALID_BYTES && await isValidVideo(outPath);
    if (!valid) {
      console.warn(`[fetch-facebook] Removing invalid cached file (${size} bytes): ${outPath}`);
      unlinkSync(outPath);
    } else {
      return NextResponse.json({ url: publicPath });
    }
  }

  try {
    // Use execFileAsync (no shell) so args are passed safely without quoting issues.
    // Format priority: H.264+AAC mp4 → any H.264 → best available then re-encode.
    // ffmpeg postprocessor re-encodes to H.264/AAC for guaranteed browser playback.
    await execFileAsync('yt-dlp', [
      '--no-playlist',
      '--max-filesize', String(MAX_BYTES),
      '-f', 'bestvideo[vcodec^=avc][ext=mp4]+bestaudio[acodec^=mp4a]/bestvideo[vcodec^=avc]+bestaudio/best',
      '--merge-output-format', 'mp4',
      '--recode-video', 'mp4',
      '--postprocessor-args', 'ffmpeg:-vcodec libx264 -acodec aac -movflags +faststart',
      '--no-warnings',
      '-o', outPath,
      '--',
      fbUrl,
    ], { timeout: 180_000 });

    // Validate the output is a real playable video
    if (!existsSync(outPath) || statSync(outPath).size < MIN_VALID_BYTES || !await isValidVideo(outPath)) {
      if (existsSync(outPath)) unlinkSync(outPath);
      return NextResponse.json(
        { error: 'Download completed but the file is not a playable video. The link may require a Facebook login.' },
        { status: 422 }
      );
    }

    return NextResponse.json({ url: publicPath });
  } catch (err: any) {
    if (existsSync(outPath)) {
      try { unlinkSync(outPath); } catch { /* ignore */ }
    }

    const stderr: string = err?.stderr ?? err?.message ?? '';
    console.error('[fetch-facebook] yt-dlp error:', stderr);

    // Detect login-walled content
    const needsLogin =
      stderr.includes('login') ||
      stderr.includes('cookies') ||
      stderr.includes('private') ||
      stderr.includes('unavailable') ||
      stderr.includes('This content');

    const message = needsLogin
      ? 'This video requires a Facebook login to access. Only fully public videos can be downloaded.'
      : 'Could not download video. It may have been deleted or is unavailable.';

    return NextResponse.json({ error: message }, { status: 422 });
  }
}
