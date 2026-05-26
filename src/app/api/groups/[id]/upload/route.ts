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
 * Convert JXR → PNG by calling JxrDecApp directly (bypasses ImageMagick delegates entirely).
 *
 * Pipeline: .jxr → JxrDecApp → .pnm → convert → .png
 *
 * PNM needs no ImageMagick delegate, so step 2 is always safe.
 */
async function convertJxrToPng(jxrPath: string, pngOutPath: string): Promise<void> {
  const pnmPath = pngOutPath.replace(/\.png$/, '.tmp.pnm');

  console.log(`[jxr] Starting conversion: ${jxrPath} -> ${pngOutPath}`);
  console.log(`[jxr] Intermediate PNM: ${pnmPath}`);
  console.log(`[jxr] JxrDecApp exists: ${existsSync('/usr/local/bin/JxrDecApp')}`);
  console.log(`[jxr] Input file size: ${existsSync(jxrPath) ? statSync(jxrPath).size : 'MISSING'}`);

  try {
    // Step 1: JxrDecApp decodes .jxr -> .pnm
    let decodeResult: { stdout?: string; stderr?: string } = {};
    try {
      decodeResult = await execFileAsync('/usr/local/bin/JxrDecApp', [
        '-i', jxrPath,
        '-o', pnmPath,
      ], { timeout: 60_000 });
      console.log(`[jxr] JxrDecApp stdout: ${decodeResult.stdout}`);
      console.log(`[jxr] JxrDecApp stderr: ${decodeResult.stderr}`);
    } catch (decodeErr: any) {
      console.error(`[jxr] JxrDecApp FAILED`);
      console.error(`[jxr]   code:   ${decodeErr.code}`);
      console.error(`[jxr]   signal: ${decodeErr.signal}`);
      console.error(`[jxr]   stdout: ${decodeErr.stdout}`);
      console.error(`[jxr]   stderr: ${decodeErr.stderr}`);
      console.error(`[jxr]   message: ${decodeErr.message}`);
      throw decodeErr;
    }

    const pnmExists = existsSync(pnmPath);
    const pnmSize = pnmExists ? statSync(pnmPath).size : 0;
    console.log(`[jxr] PNM exists: ${pnmExists}, size: ${pnmSize}`);

    if (!pnmExists || pnmSize < MIN_VALID_BYTES) {
      throw new Error(`JxrDecApp produced no valid .pnm (exists=${pnmExists}, size=${pnmSize})`);
    }

    // Step 2: convert .pnm -> .png (PNM is natively supported, no delegate)
    try {
      const convertResult = await execFileAsync('convert', [pnmPath, pngOutPath], { timeout: 60_000 });
      console.log(`[jxr] convert stdout: ${convertResult.stdout}`);
      console.log(`[jxr] convert stderr: ${convertResult.stderr}`);
    } catch (convertErr: any) {
      console.error(`[jxr] convert (PNM->PNG) FAILED`);
      console.error(`[jxr]   code:   ${convertErr.code}`);
      console.error(`[jxr]   stdout: ${convertErr.stdout}`);
      console.error(`[jxr]   stderr: ${convertErr.stderr}`);
      console.error(`[jxr]   message: ${convertErr.message}`);
      throw convertErr;
    }

    const pngExists = existsSync(pngOutPath);
    const pngSize = pngExists ? statSync(pngOutPath).size : 0;
    console.log(`[jxr] PNG exists: ${pngExists}, size: ${pngSize}`);

  } finally {
    if (existsSync(pnmPath)) unlink(pnmPath).catch(() => {});
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
      // JXR path — must have .jxr extension or JxrDecApp refuses to read it
      const jxrFilename = `${id}.tmp.jxr`;
      const jxrPath = join(uploadDir, jxrFilename);
      const outFilename = `${id}.png`;
      const outPath = join(uploadDir, outFilename);

      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(jxrPath, buffer);
      console.log(`[upload] JXR written to ${jxrPath} (${buffer.length} bytes)`);

      try {
        await convertJxrToPng(jxrPath, outPath);

        if (!existsSync(outPath) || statSync(outPath).size < MIN_VALID_BYTES) {
          throw new Error('JXR conversion produced no valid PNG');
        }

        console.log(`[upload] JXR->PNG success: ${outPath} (${statSync(outPath).size} bytes)`);
      } catch (err: any) {
        await unlink(jxrPath).catch(() => {});
        console.error(`[upload] JXR conversion pipeline error: ${err.message}`);
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

    // Standard image
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
