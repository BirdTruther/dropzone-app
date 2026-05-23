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
const ALLOWED_IMAGE = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

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
  ], { timeout: 600_000 }); // 10 min max for large videos
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
  const isImage = ALLOWED_IMAGE.includes(file.type);
  if (!isVideo && !isImage) return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });

  const currentSize = await getUploadsSize();
  if (currentSize + file.size > MAX_VOLUME_SIZE) {
    return NextResponse.json({ error: 'Storage is full. Please contact the admin.' }, { status: 507 });
  }

  const uploadDir = join(process.cwd(), 'public', 'uploads');
  await mkdir(uploadDir, { recursive: true });

  const id = randomUUID();

  if (isImage) {
    // Images: write directly, no conversion needed
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
        uploadStatus: null, // not used for images
        authorId: user.id,
        groupId: params.id,
      },
      include: { author: { select: { id: true, name: true, avatar: true } }, reactions: true },
    });
    return NextResponse.json(post, { status: 201 });
  }

  // ── Video path ──────────────────────────────────────────────────────────────
  // 1. Write raw upload to a .tmp file immediately
  const tmpFilename = `${id}.tmp`;
  const tmpPath = join(uploadDir, tmpFilename);
  const outFilename = `${id}.mp4`;
  const outPath = join(uploadDir, outFilename);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(tmpPath, buffer);

  // 2. Create post immediately with status 'processing' so it appears in feed
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

  // 3. Respond 201 immediately — client is unblocked
  // Fire-and-forget background conversion
  const postId = post.id;
  setImmediate(async () => {
    try {
      await convertToMp4(tmpPath, outPath);

      // Validate output
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
      // Always clean up the tmp file
      if (existsSync(tmpPath)) {
        unlink(tmpPath).catch(() => {});
      }
      // If conversion failed, also remove the incomplete output
      if (existsSync(outPath)) {
        const { size } = statSync(outPath);
        if (size < MIN_VALID_BYTES) unlink(outPath).catch(() => {});
      }
    }
  });

  return NextResponse.json(post, { status: 201 });
}
