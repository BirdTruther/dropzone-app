import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { MAX_FILE_SIZE, MAX_VOLUME_SIZE, getUploadsSize } from '@/lib/storage';

const ALLOWED_VIDEO = ['video/mp4', 'video/quicktime', 'video/webm'];
const ALLOWED_IMAGE = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const EXPIRE_DAYS = 7;

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

  // Check volume cap
  const currentSize = await getUploadsSize();
  if (currentSize + file.size > MAX_VOLUME_SIZE) {
    return NextResponse.json({
      error: `Storage full — uploads are limited to 20GB total. Try again after some files expire.`,
    }, { status: 507 });
  }

  const ext = file.name.split('.').pop() ?? (isVideo ? 'mp4' : 'jpg');
  const filename = `${randomUUID()}.${ext}`;
  const uploadDir = join(process.cwd(), 'public', 'uploads');
  await mkdir(uploadDir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(join(uploadDir, filename), buffer);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + EXPIRE_DAYS);

  const post = await prisma.post.create({
    data: {
      url: '',
      note: note || null,
      uploadUrl: `/uploads/${filename}`,
      uploadType: isVideo ? 'video' : 'image',
      expiresAt,
      authorId: user.id,
      groupId: params.id,
    },
    include: { author: { select: { id: true, name: true, avatar: true } }, reactions: true },
  });

  return NextResponse.json(post, { status: 201 });
}
