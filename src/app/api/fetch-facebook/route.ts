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

// Track in-progress downloads so concurrent requests don’t double-spawn yt-dlp
const inProgress = new Set<string>();

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

function getHashedPaths(fbUrl: string) {
  const hash = crypto.createHash('sha256').update(fbUrl).digest('hex').slice(0, 16);
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  return {
    uploadsDir,
    outPath: path.join(uploadsDir, `fb_${hash}.mp4`),
    tmpPath: path.join(uploadsDir, `fb_${hash}.tmp.mp4`),
    // Keep serving via the API route so it stays behind auth.
    // The MIME error was a browser caching issue, not a path issue —
    // the API route correctly sets Content-Type via NextResponse headers.
    publicPath: `/api/uploads/fb_${hash}.mp4`,
    hash,
  };
}

/**
 * GET /api/fetch-facebook?url=<encoded_fb_url>
 * Lightweight status check — no ffprobe, just a file-size check.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const fbUrl = req.nextUrl.searchParams.get('url');
  if (!fbUrl) return NextResponse.json({ error: 'Missing url param' }, { status: 400 });

  const { outPath, publicPath, hash } = getHashedPaths(fbUrl);

  if (existsSync(outPath)) {
    const { size } = statSync(outPath);
    if (size >= MIN_VALID_BYTES) {
      return NextResponse.json({ status: 'ready', url: publicPath });
    }
  }

  if (inProgress.has(hash)) {
    return NextResponse.json({ status: 'pending' });
  }

  return NextResponse.json({ status: 'not_started' });
}

/**
 * POST /api/fetch-facebook
 * Starts or returns a cached Facebook video download.
 */
export async function POST(req: NextRequest) {
  const internalSecret = process.env.INTERNAL_API_SECRET;
  const callerSecret = req.headers.get('x-internal-secret');
  const isInternalCall = internalSecret && callerSecret === internalSecret;

  if (!isInternalCall) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
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

  const { uploadsDir, outPath, tmpPath, publicPath, hash } = getHashedPaths(fbUrl);
  if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

  if (existsSync(outPath)) {
    const { size } = statSync(outPath);
    const valid = size >= MIN_VALID_BYTES && await isValidVideo(outPath);
    if (valid) return NextResponse.json({ url: publicPath });
    console.warn(`[fetch-facebook] Removing invalid cached file (${size} bytes): ${outPath}`);
    unlinkSync(outPath);
  }

  if (inProgress.has(hash)) {
    return NextResponse.json({ status: 'pending' }, { status: 202 });
  }

  if (existsSync(tmpPath)) {
    try { unlinkSync(tmpPath); } catch { /* ignore */ }
  }

  inProgress.add(hash);
  try {
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

    try { unlinkSync(tmpPath); } catch { /* ignore */ }

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
  } finally {
    inProgress.delete(hash);
  }
}
