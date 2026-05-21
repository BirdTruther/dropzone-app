import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (user?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [users, groups, posts, comments, reactions, pushSubscriptions, groupStats] = await Promise.all([
    prisma.user.count(),
    prisma.group.count(),
    prisma.post.count(),
    prisma.comment.count(),
    prisma.reaction.count(),
    prisma.pushSubscription.count(),
    prisma.group.findMany({
      select: {
        id: true,
        name: true,
        emoji: true,
        _count: { select: { posts: true, members: true } },
      },
      orderBy: { posts: { _count: 'desc' } },
    }),
  ]);

  return NextResponse.json({ users, groups, posts, comments, reactions, pushSubscriptions, groupStats });
}
