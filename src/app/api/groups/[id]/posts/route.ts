import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fetchLinkPreview } from '@/lib/og';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const member = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId: params.id } },
  });
  if (!member) return NextResponse.json({ error: 'Not a member' }, { status: 403 });
  const posts = await prisma.post.findMany({
    where: { groupId: params.id },
    include: {
      author: { select: { id: true, name: true, avatar: true } },
      reactions: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(posts);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const member = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId: params.id } },
  });
  if (!member) return NextResponse.json({ error: 'Not a member' }, { status: 403 });
  const { url, note } = await req.json();
  if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 });
  const preview = await fetchLinkPreview(url);
  const post = await prisma.post.create({
    data: {
      url,
      note: note ?? null,
      title: preview.title ?? null,
      description: preview.description ?? null,
      image: preview.image ?? null,
      siteName: preview.siteName ?? null,
      authorId: session.user.id,
      groupId: params.id,
    },
    include: {
      author: { select: { id: true, name: true, avatar: true } },
      reactions: true,
    },
  });
  return NextResponse.json(post, { status: 201 });
}
