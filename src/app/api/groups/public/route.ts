import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/groups/public — public groups the current user is NOT already in.
// Used for the "Discover" section on the groups page.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any).id;

  const groups = await prisma.group.findMany({
    where: {
      isPublic: true,
      members: { none: { userId } },
    },
    include: { _count: { select: { members: true, posts: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(
    groups.map(g => ({
      id: g.id,
      name: g.name,
      emoji: g.emoji,
      description: g.description,
      _count: g._count,
    }))
  );
}
