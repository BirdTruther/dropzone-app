import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/groups/[id]/members — list members
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: user.id, groupId: params.id } },
  });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const members = await prisma.groupMember.findMany({
    where: { groupId: params.id },
    include: { user: { select: { id: true, name: true, avatar: true, email: true } } },
    orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
  });

  return NextResponse.json(members.map(m => ({
    id: m.user.id,
    name: m.user.name,
    avatar: m.user.avatar,
    email: m.user.email,
    role: m.role,
    joinedAt: m.joinedAt,
  })));
}

// DELETE /api/groups/[id]/members — remove a member (owner only)
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: user.id, groupId: params.id } },
  });
  if (!membership || membership.role !== 'owner') {
    return NextResponse.json({ error: 'Only the group owner can remove members' }, { status: 403 });
  }

  const { targetUserId } = await req.json();
  if (targetUserId === user.id) return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 });

  await prisma.groupMember.deleteMany({
    where: { userId: targetUserId, groupId: params.id },
  });

  return NextResponse.json({ ok: true });
}
