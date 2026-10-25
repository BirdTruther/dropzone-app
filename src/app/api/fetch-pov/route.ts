import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, statSync, unlinkSync, createWriteStream } from 'fs';
import { Readable } from 'stream';
import { finished } from 'stream/promises';
import path from 'path';
import { resolvePovDownloadUrl, povCacheFilename } from '@/lib/pov';

const execFileAsync = promisify(execFile);

const MAX_BYTES = 200 * 1024 * 1024; // 200 MB, same cap as the Facebook downloader
const MIN_VALID_BYTES = 100 * 1024; // 100 KB

// Track in-progress downloads so concurrent requests don't double-download
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

function getHashedPaths(povUrl: string) {
  const filename = povCacheFilename(povUrl)!;
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  return {
    uploadsDir,
    outPath: path.join(uploadsDir, filename),
    tmpPath: path.join(uploadsDir, `${filename}.tmp`),
    // Keep serving via the API route so it stays behind auth.
    publicPath: `/api/uploads/${filename}`,
    filename,
  };
}

/**
 * GET /api/fetch-pov?url=<encoded_pov_url>
 * Lightweight status check — no ffprobe, just a file-size check.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const povUrl = req.nextUrl.searchParams.get('url');
  if (!povUrl || !povCacheFilename(povUrl)) {
    return NextResponse.json({ error: 'Not a POV clip URL' }, { status: 400 });
  }

  const { outPath, publicPath, filename } = getHashedPaths(povUrl);

  if (existsSync(outPath)) {
    const { size } = statSync(outPath);
    if (size >= MIN_VALID_BYTES) {
      return NextResponse.json({ status: 'ready', url: publicPath });
    }
  }

  if (inProgress.has(filename)) {
    return NextResponse.json({ status: 'pending' });
  }

  return NextResponse.json({ status: 'not_started' });
}

/**
 * POST /api/fetch-pov
 * Starts or returns a cached POV clip download.
 *
 * Unlike Facebook, POV needs no yt-dlp extraction: a /c/<id> share page
 * maps directly to https://povshare.cc/v/<id>.mp4, so we download that
 * file directly, then transcode it to a standard browser-playable MP4
 * (libx264 / yuv420p / AAC / faststart). That fixes both problems with
 * the original link: the ~8 hour expiry, and browsers rejecting the
 * original file's codec or MIME type.
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

  let povUrl: string;
  try {
    const body = await req.json();
    povUrl = body.url;
    new URL(povUrl);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  const downloadUrl = resolvePovDownloadUrl(povUrl);
  if (!downloadUrl) {
    return NextResponse.json({ error: 'Not a POV clip URL' }, { status: 400 });
  }

  const { uploadsDir, outPath, tmpPath, publicPath, filename } = getHashedPaths(povUrl);
  if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

  if (existsSync(outPath)) {
    const { size } = statSync(outPath);
    const valid = size >= MIN_VALID_BYTES && await isValidVideo(outPath);
    if (valid) return NextResponse.json({ url: publicPath });
    console.warn(`[fetch-pov] Removing invalid cached file (${size} bytes): ${outPath}`);
    unlinkSync(outPath);
  }

  if (inProgress.has(filename)) {
    return NextResponse.json({ status: 'pending' }, { status: 202 });
  }

  if (existsSync(tmpPath)) {
    try { unlinkSync(tmpPath); } catch { /* ignore */ }
  }

  inProgress.add(filename);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180_000);
    let res: Response;
    try {
      res = await fetch(downloadUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'dropzone-pov-archive' },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok || !res.body) {
      return NextResponse.json(
        { error: 'Could not download POV clip. It may have expired or is unavailable.' },
        { status: 422 }
      );
    }

    const contentLength = res.headers.get('content-length');
    if (contentLength && Number(contentLength) > MAX_BYTES) {
      return NextResponse.json(
        { error: 'POV clip is larger than the 200 MB download limit.' },
        { status: 422 }
      );
    }

    // Stream to disk (never hold the whole clip in memory) and enforce the cap.
    const fileStream = createWriteStream(tmpPath);
    let downloaded = 0;
    const nodeStream = Readable.fromWeb(res.body as any);
    nodeStream.on('data', (chunk: Buffer) => {
      downloaded += chunk.length;
      if (downloaded > MAX_BYTES) {
        nodeStream.destroy(new Error('POV clip exceeds 200 MB'));
      }
    });
    await finished(nodeStream.pipe(fileStream));

    if (!existsSync(tmpPath) || statSync(tmpPath).size < MIN_VALID_BYTES) {
      if (existsSync(tmpPath)) unlinkSync(tmpPath);
      return NextResponse.json(
        { error: 'Download completed but the file is not a playable video. The link may have expired.' },
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
    console.error('[fetch-pov] error:', err?.message ?? err);
    const message = err?.message?.includes('200 MB')
      ? 'POV clip is larger than the 200 MB download limit.'
      : 'Could not download POV clip. It may have expired or is unavailable.';
    return NextResponse.json({ error: message }, { status: 422 });
  } finally {
    inProgress.delete(filename);
  }
}
