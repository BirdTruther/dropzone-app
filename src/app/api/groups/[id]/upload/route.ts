import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { existsSync, statSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { MAX_FILE_SIZE, MAX_VOLUME_SIZE, getUploadsSize } from '@/lib/storage';

const execFileAsync = promisify(execFile);

const ALLOWED_VIDEO = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-msvideo',
  'video/x-matroska',
  'video/mpeg',
  'video/3gpp',
];
const ALLOWED_IMAGE = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/jxr',
  'image/vnd.ms-photo',
];

const JXR_MIMES = new Set(['image/jxr', 'image/vnd.ms-photo']);

function isJxrFile(file: File): boolean {
  if (JXR_MIMES.has(file.type)) return true;
  const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase();
  return ext === '.jxr';
}

const MIN_VALID_BYTES = 10 * 1024;

async function convertToMp4(tmpPath: string, outPath: string): Promise<void> {
  await execFileAsync('ffmpeg', [
    '-y', '-i', tmpPath,
    '-vcodec', 'libx264', '-preset', 'fast', '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-acodec', 'aac', '-b:a', '128k',
    '-movflags', '+faststart',
    outPath,
  ], { timeout: 600_000 });
}

/**
 * Convert a Windows/Xbox JXR screenshot to PNG.
 *
 * Why this approach:
 *
 *   The Xbox Game Bar / Windows 11 HDR screenshot format is a TIFF container
 *   that stores JXR-compressed pixel data. The on-disk file has a standard
 *   TIFF header (magic bytes II 0x2A 0x00 or MM 0x00 0x2A), not a bare JXR
 *   bitstream.
 *
 *   - JxrDecApp (jxrlib, 2013) cannot decode this tiled/extended JXR variant;
 *     exits with code 150 "Unsupported format in JPEG XR".
 *
 *   - ImageMagick's `jxr` delegate in delegates.xml calls JxrDecApp internally
 *     and therefore fails the same way.
 *
 *   - ffmpeg's Alpine package is built with --enable-libjxl (JPEG XL, .jxl),
 *     which is a completely different format. ffmpeg has no JXR/HD-Photo
 *     demuxer; "Invalid data found" is expected.
 *
 *   - ImageMagick in this container has native TIFF support compiled in
 *     ("Delegates (built-in): ... tiff ..."). If we tell magick the file is
 *     TIFF it reads the container directly without invoking JxrDecApp at all.
 *
 * Pipeline:
 *   1. Write the .jxr bytes to a temp file named .tmp.tif
 *      (the extension is what triggers the TIFF codec path in magick)
 *   2. magick TIFF:file.tmp.tif -flatten -strip PNG:output.png
 *      -flatten  : composites alpha onto white background
 *      -strip    : removes EXIF/ICC to keep the PNG browser-safe
 *
 * If the file truly is not a TIFF-wrapped JXR (e.g. a bare JXR bitstream),
 * this call will fail and the error is surfaced to the caller cleanly.
 */
async function convertJxrToPng(jxrPath: string, pngOutPath: string): Promise<void> {
  // Write to a .tif extension so magick uses TIFF codec, not the JXR delegate
  const tifPath = jxrPath.replace(/\.tmp\.jxr$/, '.tmp.tif');

  const { rename } = await import('fs/promises');
  await rename(jxrPath, tifPath);

  console.log(`[jxr] Pipeline: magick TIFF:${tifPath} -> PNG:${pngOutPath}`);
  console.log(`[jxr] Input size: ${existsSync(tifPath) ? statSync(tifPath).size : 'MISSING'} bytes`);

  try {
    const r = await execFileAsync('magick', [
      `TIFF:${tifPath}`,
      '-flatten',
      '-strip',
      `PNG:${pngOutPath}`,
    ], { timeout: 120_000 });
    console.log(`[jxr] magick stdout: ${r.stdout}`);
    console.log(`[jxr] magick stderr: ${r.stderr}`);
  } catch (e: any) {
    // Rename back so cleanup code can still unlink by the original path variable
    await rename(tifPath, jxrPath).catch(() => {});
    console.error(`[jxr] magick FAILED`);
    console.error(`[jxr]   code:    ${e.code}`);
    console.error(`[jxr]   signal:  ${e.signal}`);
    console.error(`[jxr]   stdout:  ${e.stdout}`);
    console.error(`[jxr]   stderr:  ${e.stderr}`);
    console.error(`[jxr]   message: ${e.message}`);
    throw e;
  }

  // Cleanup the renamed temp file
  await unlink(tifPath).catch(() => {});
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: user.id, groupId: params.id } },
  });
  if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const note = (formData.get('note') as string | null)?.trim() ?? undefined;

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  console.log(`[upload] file.name=${file.name} file.type=${file.type} file.size=${file.size}`);

  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'File too large (max 100MB)' }, { status: 400 });

  const isVideo = ALLOWED_VIDEO.includes(file.type);
  const isImage = ALLOWED_IMAGE.includes(file.type) || isJxrFile(file);

  console.log(`[upload] isVideo=${isVideo} isImage=${isImage} isJxr=${isJxrFile(file)}`);

  if (!isVideo && !isImage) return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });

  const currentSize = await getUploadsSize();
  if (currentSize + file.size > MAX_VOLUME_SIZE) {
    return NextResponse.json({ error: 'Storage is full. Please contact the admin.' }, { status: 507 });
  }

  const uploadDir = join(process.cwd(), 'public', 'uploads');
  await mkdir(uploadDir, { recursive: true });

  const id = randomUUID();

  if (isImage) {
    if (isJxrFile(file)) {
      const jxrFilename = `${id}.tmp.jxr`;
      const jxrPath = join(uploadDir, jxrFilename);
      const outFilename = `${id}.png`;
      const outPath = join(uploadDir, outFilename);

      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(jxrPath, buffer);
      console.log(`[upload] JXR written: ${jxrPath} (${buffer.length} bytes)`);

      try {
        await convertJxrToPng(jxrPath, outPath);

        if (!existsSync(outPath) || statSync(outPath).size < MIN_VALID_BYTES) {
          throw new Error('magick produced no valid PNG output');
        }
        console.log(`[upload] JXR->PNG success: ${statSync(outPath).size} bytes`);
      } catch (err: any) {
        // jxrPath may have been renamed to .tif inside convertJxrToPng on failure;
        // attempt cleanup of both possible names
        const tifPath = jxrPath.replace(/\.tmp\.jxr$/, '.tmp.tif');
        await unlink(jxrPath).catch(() => {});
        await unlink(tifPath).catch(() => {});
        console.error(`[upload] JXR conversion failed: ${err.message}`);
        return NextResponse.json(
          { error: 'Could not convert JXR image. Check server logs for details.' },
          { status: 422 },
        );
      }

      // jxrPath was renamed to .tif and already cleaned up inside convertJxrToPng
      // (or renamed back and cleaned up in the catch above). Nothing to do here.

      const post = await prisma.post.create({
        data: {
          url: '',
          note: note || null,
          uploadUrl: `/api/uploads/${outFilename}`,
          uploadType: 'image',
          uploadStatus: null,
          authorId: user.id,
          groupId: params.id,
        },
        include: { author: { select: { id: true, name: true, avatar: true } }, reactions: true },
      });
      return NextResponse.json(post, { status: 201 });
    }

    // Standard image — write directly
    const ext = file.name.split('.').pop() ?? 'jpg';
    const filename = `${id}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(join(uploadDir, filename), buffer);

    const post = await prisma.post.create({
      data: {
        url: '',
        note: note || null,
        uploadUrl: `/api/uploads/${filename}`,
        uploadType: 'image',
        uploadStatus: null,
        authorId: user.id,
        groupId: params.id,
      },
      include: { author: { select: { id: true, name: true, avatar: true } }, reactions: true },
    });
    return NextResponse.json(post, { status: 201 });
  }

  // Video path
  const tmpFilename = `${id}.tmp`;
  const tmpPath = join(uploadDir, tmpFilename);
  const outFilename = `${id}.mp4`;
  const outPath = join(uploadDir, outFilename);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(tmpPath, buffer);

  const post = await prisma.post.create({
    data: {
      url: '',
      note: note || null,
      uploadUrl: `/api/uploads/${outFilename}`,
      uploadType: 'video',
      uploadStatus: 'processing',
      authorId: user.id,
      groupId: params.id,
    },
    include: { author: { select: { id: true, name: true, avatar: true } }, reactions: true },
  });

  const postId = post.id;
  setImmediate(async () => {
    try {
      await convertToMp4(tmpPath, outPath);
      if (!existsSync(outPath) || statSync(outPath).size < MIN_VALID_BYTES) {
        throw new Error('Output file missing or too small after conversion');
      }
      await prisma.post.update({ where: { id: postId }, data: { uploadStatus: 'ready' } });
    } catch (err) {
      console.error(`[upload] ffmpeg conversion failed for post ${postId}:`, err);
      await prisma.post.update({ where: { id: postId }, data: { uploadStatus: 'error' } }).catch(() => {});
    } finally {
      if (existsSync(tmpPath)) unlink(tmpPath).catch(() => {});
      if (existsSync(outPath)) {
        const { size } = statSync(outPath);
        if (size < MIN_VALID_BYTES) unlink(outPath).catch(() => {});
      }
    }
  });

  return NextResponse.json(post, { status: 201 });
}
