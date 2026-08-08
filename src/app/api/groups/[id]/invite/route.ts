import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/groups/[id]/invite?q= — search registered users to add to a group.
// Owner/admin only. Excludes existing members.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any).id;

  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId: params.id } },
    select: { role: true },
  });
  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'Only owners or admins can invite members' }, { status: 403 });
  }

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (!q) return NextResponse.json([]);

  const members = await prisma.groupMember.findMany({
    where: { groupId: params.id },
    select: { userId: true },
  });
  const memberIds = members.map(m => m.userId);

  const users = await prisma.user.findMany({
    where: { id: { notIn: memberIds }, name: { contains: q, mode: 'insensitive' } },
    take: 8,
    select: { id: true, name: true, avatar: true },
  });

  return NextResponse.json(users);
}
