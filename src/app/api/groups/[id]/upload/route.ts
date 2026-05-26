import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir, unlink, rename } from 'fs/promises';
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
  'video/x-msvideo',       // AVI
  'video/x-matroska',      // MKV
  'video/mpeg',
  'video/3gpp',
];
const ALLOWED_IMAGE = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/jxr',             // Windows HDR screenshots
  'image/vnd.ms-photo',    // alternate MIME for JXR
];

const JXR_EXTENSIONS = ['.jxr'];
const JXR_MIMES = new Set(['image/jxr', 'image/vnd.ms-photo']);

function isJxrFile(file: File): boolean {
  if (JXR_MIMES.has(file.type)) return true;
  const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase();
  return JXR_EXTENSIONS.includes(ext);
}

const MIN_VALID_BYTES = 10 * 1024; // 10 KB

async function convertToMp4(tmpPath: string, outPath: string): Promise<void> {
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
  ], { timeout: 600_000 });
}

/**
 * Convert a JXR file to PNG without touching ImageMagick at all.
 *
 * Why bypass ImageMagick:
 *   - Alpine's packaged ImageMagick v6 delegates.xml uses hard-coded /usr/bin/mv
 *     which doesn't exist on Alpine (it lives at /bin/mv), so the JXR delegate
 *     shell command fails silently before JxrDecApp ever runs.
 *   - Even if the path were correct, the Alpine build of ImageMagick is unlikely
 *     to have a JXR delegate entry at all.
 *
 * Pipeline:
 *   1. JxrDecApp reads the .jxr and writes a .pnm (portable anymap) file.
 *      JxrDecApp requires the input file extension to literally be .jxr —
 *      we already saved the upload as <id>.tmp.jxr so that is satisfied.
 *   2. ImageMagick `convert` turns the .pnm into a .png.
 *      PNM is a trivially-supported format that needs no delegates at all.
 */
async function convertJxrToPng(jxrPath: string, pngOutPath: string): Promise<void> {
  const pnmPath = pngOutPath.replace(/\.png$/, '.tmp.pnm');

  try {
    // Step 1 — JxrDecApp: .jxr → .pnm
    // -i  input file  (must end in .jxr)
    // -o  output file (JxrDecApp names it <base>.pnm automatically)
    await execFileAsync('/usr/local/bin/JxrDecApp', [
      '-i', jxrPath,
      '-o', pnmPath,
    ], { timeout: 60_000 });

    if (!existsSync(pnmPath) || statSync(pnmPath).size < MIN_VALID_BYTES) {
      throw new Error('JxrDecApp produced no .pnm output');
    }

    // Step 2 — ImageMagick convert: .pnm → .png  (no delegate needed for PNM)
    await execFileAsync('convert', [pnmPath, pngOutPath], { timeout: 60_000 });
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
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'File too large (max 100MB)' }, { status: 400 });

  const isVideo = ALLOWED_VIDEO.includes(file.type);
  const isImage = ALLOWED_IMAGE.includes(file.type) || isJxrFile(file);
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
      // Write with a .jxr extension — JxrDecApp requires the extension to be .jxr
      const jxrFilename = `${id}.tmp.jxr`;
      const jxrPath = join(uploadDir, jxrFilename);
      const outFilename = `${id}.png`;
      const outPath = join(uploadDir, outFilename);

      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(jxrPath, buffer);

      try {
        await convertJxrToPng(jxrPath, outPath);

        if (!existsSync(outPath) || statSync(outPath).size < MIN_VALID_BYTES) {
          throw new Error('JXR conversion produced no PNG output');
        }
      } catch (err) {
        await unlink(jxrPath).catch(() => {});
        console.error('[upload] JXR conversion failed:', err);
        return NextResponse.json(
          { error: 'Could not convert JXR image. The file may be corrupt.' },
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

    // Standard images — write directly, no conversion needed
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

  // ── Video path ──────────────────────────────────────────────────────────────
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

      await prisma.post.update({
        where: { id: postId },
        data: { uploadStatus: 'ready' },
      });
    } catch (err) {
      console.error(`[upload] ffmpeg conversion failed for post ${postId}:`, err);
      await prisma.post.update({
        where: { id: postId },
        data: { uploadStatus: 'error' },
      }).catch(() => {});
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
