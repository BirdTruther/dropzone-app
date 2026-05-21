import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function requireSiteAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user?.isSiteAdmin) return null;
  return user;
}

export async function GET() {
  const admin = await requireSiteAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

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
