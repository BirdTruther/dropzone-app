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
  const tmpPath = path.join(uploadsDir, `fb_${hash}.tmp.mp4`);
  const publicPath = `/api/uploads/fb_${hash}.mp4`;

  // Return cached file if it already exists and is valid
  if (existsSync(outPath)) {
    const { size } = statSync(outPath);
    const valid = size >= MIN_VALID_BYTES && await isValidVideo(outPath);
    if (valid) return NextResponse.json({ url: publicPath });
    console.warn(`[fetch-facebook] Removing invalid cached file (${size} bytes): ${outPath}`);
    unlinkSync(outPath);
  }

  // Clean up any leftover temp file from a previous failed attempt
  if (existsSync(tmpPath)) {
    try { unlinkSync(tmpPath); } catch { /* ignore */ }
  }

  try {
    // Step 1: Download raw video to temp file (best quality, no re-encode yet)
    await execFileAsync('yt-dlp', [
      '--no-playlist',
      '--max-filesize', String(MAX_BYTES),
      '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best',
      '--merge-output-format', 'mp4',
      '--no-warnings',
      '-o', tmpPath,
      '--',
      fbUrl,
    ], { timeout: 180_000 });

    if (!existsSync(tmpPath) || statSync(tmpPath).size < MIN_VALID_BYTES) {
      if (existsSync(tmpPath)) unlinkSync(tmpPath);
      return NextResponse.json(
        { error: 'Download completed but the file is not a playable video. The link may require a Facebook login.' },
        { status: 422 }
      );
    }

    // Step 2: Re-encode to H.264 (8-bit yuv420p) + AAC for guaranteed browser playback.
    // -pix_fmt yuv420p: forces 8-bit color depth — required because newer Facebook
    //   videos are often 10-bit (yuv420p10le) which Chrome cannot play in H.264.
    // -movflags +faststart: moves the moov atom to the front for progressive playback.
    // NOTE: -f mp4 is intentionally omitted — the output extension already implies
    //   the container, and combining -f mp4 with +faststart can corrupt the moov atom.
    await execFileAsync('ffmpeg', [
      '-y',
      '-i', tmpPath,
      '-vcodec', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-pix_fmt', 'yuv420p',
      '-acodec', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      outPath,
    ], { timeout: 300_000 });

    // Remove the raw temp file
    try { unlinkSync(tmpPath); } catch { /* ignore */ }

    // Validate the final output
    if (!existsSync(outPath) || statSync(outPath).size < MIN_VALID_BYTES || !await isValidVideo(outPath)) {
      if (existsSync(outPath)) unlinkSync(outPath);
      return NextResponse.json(
        { error: 'Video processing failed. Please try again.' },
        { status: 422 }
      );
    }

    return NextResponse.json({ url: publicPath });

  } catch (err: any) {
    for (const f of [tmpPath, outPath]) {
      if (existsSync(f)) try { unlinkSync(f); } catch { /* ignore */ }
    }

    const stderr: string = err?.stderr ?? err?.message ?? '';
    console.error('[fetch-facebook] error:', stderr);

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
