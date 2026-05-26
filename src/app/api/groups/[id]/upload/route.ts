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
 * Convert JXR -> PNG using ffmpeg.
 *
 * Why ffmpeg instead of JxrDecApp / ImageMagick:
 *   - jxrlib (JxrDecApp) cannot decode the HD Photo "Extended" / tiled JXR
 *     container used by Windows 11 / Xbox HDR screenshots. It exits with
 *     code 150 "Unsupported format in JPEG XR" regardless of output format.
 *   - ImageMagick's JXR delegate also calls JxrDecApp internally (same failure),
 *     and Alpine's imagemagick package has no libtiff, making the TIFF
 *     intermediate path fail as well.
 *   - ffmpeg ships with a full, modern JXR decoder (via its internal xwddec
 *     and jxr demuxer) and is already installed in the container for video.
 *
 * Pipeline:
 *   ffmpeg -i file.jxr -vf scale=iw:ih -pix_fmt rgb24 -frames:v 1 file.png
 *
 *   -pix_fmt rgb24   : tone-maps HDR float/half-float pixel formats to 8bpc
 *   -frames:v 1      : output exactly one frame (JXR is treated as single-frame video)
 *   -vf scale=iw:ih  : forces pixel format conversion through the scale filter
 *                      which handles wide-gamut / HDR -> sRGB correctly
 */
async function convertJxrToPng(jxrPath: string, pngOutPath: string): Promise<void> {
  console.log(`[jxr] ffmpeg JXR->PNG: ${jxrPath} -> ${pngOutPath}`);
  console.log(`[jxr] Input size: ${existsSync(jxrPath) ? statSync(jxrPath).size : 'MISSING'} bytes`);

  try {
    const r = await execFileAsync('ffmpeg', [
      '-y',
      '-i', jxrPath,
      '-vf', 'scale=iw:ih',
      '-pix_fmt', 'rgb24',
      '-frames:v', '1',
      pngOutPath,
    ], { timeout: 120_000 });
    console.log(`[jxr] ffmpeg stdout: ${r.stdout}`);
    console.log(`[jxr] ffmpeg stderr: ${r.stderr}`);
  } catch (e: any) {
    console.error(`[jxr] ffmpeg FAILED`);
    console.error(`[jxr]   code:    ${e.code}`);
    console.error(`[jxr]   signal:  ${e.signal}`);
    console.error(`[jxr]   stdout:  ${e.stdout}`);
    console.error(`[jxr]   stderr:  ${e.stderr}`);
    console.error(`[jxr]   message: ${e.message}`);
    throw e;
  }
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
      // ffmpeg sniffs the JXR format from file headers, extension doesn't matter,
      // but keeping .jxr is fine and consistent.
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
          throw new Error('ffmpeg produced no valid PNG output');
        }
        console.log(`[upload] JXR->PNG success: ${statSync(outPath).size} bytes`);
      } catch (err: any) {
        await unlink(jxrPath).catch(() => {});
        console.error(`[upload] JXR conversion failed: ${err.message}`);
        return NextResponse.json(
          { error: 'Could not convert JXR image. Check server logs for details.' },
          { status: 422 },
        );
      }

      await unlink(jxrPath).catch(() => {});

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
