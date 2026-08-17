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
import { notifyGroupMembers } from '@/lib/notifications';

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
 * Pipeline:
 *   1. JxrDecApp -i input.jxr -o intermediate.tif
 *      JxrDecApp (built from jxrlib source in the Dockerfile) decodes the raw
 *      JXR bitstream and writes a standard TIFF file that ImageMagick can read.
 *
 *   2. magick intermediate.tif -flatten -strip PNG:output.png
 *      -flatten  composites any alpha onto white background.
 *      -strip    removes EXIF/ICC to keep the PNG browser-safe.
 *
 * Why not ffmpeg:
 *   Alpine's ffmpeg package has --enable-libjxl (JPEG XL) but no JXR/HD-Photo
 *   demuxer. Passing a .jxr file produces "Invalid data found" regardless of
 *   the file extension used.
 *
 * Why not ImageMagick alone:
 *   ImageMagick's JXR delegate calls JxrDecApp internally via delegates.xml,
 *   but the Alpine imagemagick package ships with an incomplete delegates.xml
 *   that omits the jxr entry, so magick never invokes the binary at all.
 *   Calling JxrDecApp directly bypasses that lookup entirely.
 */
async function convertJxrToPng(jxrPath: string, pngOutPath: string): Promise<void> {
  const tifPath = jxrPath.replace(/\.tmp\.jxr$/, '.tmp.tif');

  console.log(`[jxr] Step 1: JxrDecApp ${jxrPath} -> ${tifPath}`);
  console.log(`[jxr] Input size: ${existsSync(jxrPath) ? statSync(jxrPath).size : 'MISSING'} bytes`);

  try {
    const r1 = await execFileAsync('JxrDecApp', [
      '-i', jxrPath,
      '-o', tifPath,
    ], { timeout: 120_000 });
    console.log(`[jxr] JxrDecApp stdout: ${r1.stdout}`);
    console.log(`[jxr] JxrDecApp stderr: ${r1.stderr}`);
  } catch (e: any) {
    console.error(`[jxr] JxrDecApp FAILED`);
    console.error(`[jxr]   code:    ${e.code}`);
    console.error(`[jxr]   signal:  ${e.signal}`);
    console.error(`[jxr]   stdout:  ${e.stdout}`);
    console.error(`[jxr]   stderr:  ${e.stderr}`);
    console.error(`[jxr]   message: ${e.message}`);
    throw e;
  }

  if (!existsSync(tifPath) || statSync(tifPath).size < MIN_VALID_BYTES) {
    throw new Error(`JxrDecApp produced no valid TIFF output at ${tifPath}`);
  }
  console.log(`[jxr] Step 1 OK: TIFF size = ${statSync(tifPath).size} bytes`);

  console.log(`[jxr] Step 2: magick ${tifPath} -> PNG:${pngOutPath}`);
  try {
    const r2 = await execFileAsync('magick', [
      tifPath,
      '-flatten',
      '-strip',
      `PNG:${pngOutPath}`,
    ], { timeout: 120_000 });
    console.log(`[jxr] magick stdout: ${r2.stdout}`);
    console.log(`[jxr] magick stderr: ${r2.stderr}`);
  } catch (e: any) {
    console.error(`[jxr] magick FAILED`);
    console.error(`[jxr]   code:    ${e.code}`);
    console.error(`[jxr]   signal:  ${e.signal}`);
    console.error(`[jxr]   stdout:  ${e.stdout}`);
    console.error(`[jxr]   stderr:  ${e.stderr}`);
    console.error(`[jxr]   message: ${e.message}`);
    throw e;
  } finally {
    // Always clean up the intermediate TIFF regardless of magick outcome
    await unlink(tifPath).catch(() => {});
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, isSiteAdmin: true },
  });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const isAdmin = user.isSiteAdmin === true;

  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: user.id, groupId: params.id } },
  });
  if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const note = (formData.get('note') as string | null)?.trim() ?? undefined;

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  console.log(`[upload] file.name=${file.name} file.type=${file.type} file.size=${file.size} isAdmin=${isAdmin}`);

  if (!isAdmin && file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File too large (max 100MB)' }, { status: 400 });
  }

  const isVideo = ALLOWED_VIDEO.includes(file.type);
  const isImage = ALLOWED_IMAGE.includes(file.type) || isJxrFile(file);

  console.log(`[upload] isVideo=${isVideo} isImage=${isImage} isJxr=${isJxrFile(file)}`);

  if (!isVideo && !isImage) return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });

  if (!isAdmin) {
    const currentSize = await getUploadsSize();
    if (currentSize + file.size > MAX_VOLUME_SIZE) {
      return NextResponse.json({ error: 'Storage is full. Please contact the admin.' }, { status: 507 });
    }
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
          throw new Error('Pipeline produced no valid PNG output');
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
      notifyGroupMembers({
        groupId: params.id,
        actorId: user.id,
        type: 'new_post',
        message: 'uploaded an image',
      }).catch(() => {});
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
    notifyGroupMembers({
      groupId: params.id,
      actorId: user.id,
      type: 'new_post',
      message: 'uploaded an image',
    }).catch(() => {});
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
  notifyGroupMembers({
    groupId: params.id,
    actorId: user.id,
    type: 'new_post',
    message: 'uploaded a video',
  }).catch(() => {});

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
