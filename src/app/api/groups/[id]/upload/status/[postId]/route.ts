import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; postId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // Verify the requester is actually in this group
  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: user.id, groupId: params.id } },
  });
  if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

  const post = await prisma.post.findUnique({
    where: { id: params.postId },
    select: { uploadStatus: true, uploadUrl: true, groupId: true },
  });

  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  // Ensure the post actually belongs to this group
  if (post.groupId !== params.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ uploadStatus: post.uploadStatus, uploadUrl: post.uploadUrl });
}
