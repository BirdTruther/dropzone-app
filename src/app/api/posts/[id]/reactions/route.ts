import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { emoji } = await req.json();
  if (!emoji) return NextResponse.json({ error: 'Emoji required' }, { status: 400 });

  const existing = await prisma.reaction.findUnique({
    where: { userId_postId_emoji: { userId: session.user.id, postId: params.id, emoji } },
  });
  if (existing) {
    await prisma.reaction.delete({ where: { id: existing.id } });
    return NextResponse.json({ removed: true });
  }

  const reaction = await prisma.reaction.create({
    data: { emoji, userId: session.user.id, postId: params.id },
  });

  // Notify the post author (skip if reacting to own post)
  const post = await prisma.post.findUnique({
    where: { id: params.id },
    select: { authorId: true, title: true, url: true, groupId: true },
  });
  if (post && post.authorId !== session.user.id) {
    const reactor = await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true, avatar: true } });
    const postLabel = post.title ? `"${post.title.slice(0, 40)}${post.title.length > 40 ? '…' : ''}"` : 'your post';
    await createNotification({
      userId: post.authorId,
      type: 'reaction',
      message: `${reactor?.name ?? 'Someone'} reacted ${emoji} to ${postLabel}`,
      link: `/groups/${post.groupId}`,
      actorName: reactor?.name ?? undefined,
      actorAvatar: reactor?.avatar ?? undefined,
    });
  }

  return NextResponse.json(reaction);
}
