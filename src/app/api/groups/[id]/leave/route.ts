import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST /api/groups/[id]/leave — self-service leave.
// - Regular member: removes their own membership.
// - Owner with other members present: promotes the longest-standing other
//   member to owner, then removes the leaving owner's membership.
// - Owner with no other members: deletes the group entirely (cascades
//   posts, comments, reactions, etc. via the schema's onDelete: Cascade).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any).id;

  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId: params.id } },
  });
  if (!membership) return NextResponse.json({ error: 'Not a member of this group' }, { status: 404 });

  if (membership.role !== 'owner') {
    await prisma.groupMember.delete({ where: { id: membership.id } });
    return NextResponse.json({ ok: true, result: 'left' });
  }

  // Leaving as owner — find the next-longest-standing member, if any.
  const nextOwner = await prisma.groupMember.findFirst({
    where: { groupId: params.id, userId: { not: userId } },
    orderBy: { joinedAt: 'asc' },
  });

  if (!nextOwner) {
    await prisma.group.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true, result: 'group_deleted' });
  }

  await prisma.$transaction([
    prisma.groupMember.update({ where: { id: nextOwner.id }, data: { role: 'owner' } }),
    prisma.groupMember.delete({ where: { id: membership.id } }),
  ]);

  return NextResponse.json({ ok: true, result: 'ownership_transferred' });
}
