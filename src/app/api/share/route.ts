import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { postId } = await req.json();
  if (!postId) return NextResponse.json({ error: 'Missing postId' }, { status: 400 });

  // Verify the post exists and user is a member of the group
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { group: { include: { members: true } } },
  });
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

  const userId = (session.user as any).id;
  const isMember = post.group.members.some((m: any) => m.userId === userId);
  if (!isMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Reuse existing token if one exists for this post
  const existing = await prisma.shareToken.findFirst({ where: { postId } });
  if (existing) {
    const url = `${process.env.NEXTAUTH_URL}/share/${existing.token}`;
    return NextResponse.json({ url });
  }

  const shareToken = await prisma.shareToken.create({ data: { postId } });
  const url = `${process.env.NEXTAUTH_URL}/share/${shareToken.token}`;
  return NextResponse.json({ url });
}
