import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fetchLinkPreview } from '@/lib/og';
import { createNotification } from '@/lib/notifications';

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

  // Notify all other group members about the new post
  const group = await prisma.group.findUnique({ where: { id: params.id }, select: { name: true, emoji: true } });
  const allMembers = await prisma.groupMember.findMany({
    where: { groupId: params.id, userId: { not: session.user.id } },
    select: { userId: true },
  });
  const poster = await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true, avatar: true } });
  const postTitle = preview.title ? `"${preview.title.slice(0, 40)}${preview.title.length > 40 ? '…' : ''}"` : 'a link';
  await Promise.all(
    allMembers.map(m =>
      createNotification({
        userId: m.userId,
        type: 'new_post',
        message: `${poster?.name ?? 'Someone'} dropped ${postTitle} in ${group?.emoji ?? ''} ${group?.name ?? 'a group'}`,
        link: `/groups/${params.id}`,
        actorName: poster?.name ?? undefined,
        actorAvatar: poster?.avatar ?? undefined,
      })
    )
  );

  return NextResponse.json(post, { status: 201 });
}
