import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// DELETE /api/posts/[id]/comments/[commentId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; commentId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as any).id;

  const comment = await prisma.comment.findUnique({
    where: { id: params.commentId },
    include: { post: { select: { groupId: true, authorId: true } } },
  });

  if (!comment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isCommentAuthor = comment.authorId === userId;
  const isPostAuthor = comment.post.authorId === userId;

  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId: comment.post.groupId } },
  });
  const isGroupAdmin = membership?.role === 'owner' || membership?.role === 'admin';

  if (!isCommentAuthor && !isPostAuthor && !isGroupAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.comment.delete({ where: { id: params.commentId } });
  return NextResponse.json({ ok: true });
}
