import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/posts/[id]/comments
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const post = await prisma.post.findUnique({
    where: { id: params.id },
    select: { groupId: true },
  });
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const userId = (session.user as any).id;
  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId: post.groupId } },
  });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const comments = await prisma.comment.findMany({
    where: { postId: params.id },
    orderBy: { createdAt: 'asc' },
    include: {
      author: { select: { id: true, name: true, avatar: true } },
    },
  });

  return NextResponse.json(comments);
}

// POST /api/posts/[id]/comments
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as any).id;
  const { body } = await req.json();
  if (!body?.trim()) return NextResponse.json({ error: 'Comment cannot be empty' }, { status: 400 });

  const post = await prisma.post.findUnique({
    where: { id: params.id },
    select: { groupId: true, authorId: true },
  });
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId: post.groupId } },
  });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const comment = await prisma.comment.create({
    data: { body: body.trim(), authorId: userId, postId: params.id },
    include: { author: { select: { id: true, name: true, avatar: true } } },
  });

  // Notify post author if someone else commented
  if (post.authorId !== userId) {
    const commenter = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, avatar: true },
    });
    await prisma.notification.create({
      data: {
        userId: post.authorId,
        type: 'comment',
        message: `${commenter?.name ?? 'Someone'} commented on your post`,
        link: `/groups/${post.groupId}`,
        actorName: commenter?.name,
        actorAvatar: commenter?.avatar ?? null,
      },
    });
  }

  return NextResponse.json(comment, { status: 201 });
}
