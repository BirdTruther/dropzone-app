import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function getMembership(userId: string, groupId: string) {
  return prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId } },
    select: { role: true },
  });
}

// GET /api/groups/[id]/members — returns group members for @mention autocomplete
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as any).id;

  const membership = await getMembership(userId, params.id);
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const members = await prisma.groupMember.findMany({
    where: { groupId: params.id },
    select: {
      id: true,
      role: true,
      joinedAt: true,
      user: { select: { id: true, name: true, avatar: true, email: true } },
    },
  });

  return NextResponse.json(
    members.map(m => ({ id: m.user.id, name: m.user.name, avatar: m.user.avatar, email: m.user.email, role: m.role, joinedAt: m.joinedAt }))
  );
}

// POST /api/groups/[id]/members — owner/admin adds a member by userId
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any).id;

  const membership = await getMembership(userId, params.id);
  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'Only owners or admins can add members' }, { status: 403 });
  }

  const { targetUserId } = await req.json();
  if (!targetUserId) return NextResponse.json({ error: 'User required' }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const existing = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: targetUserId, groupId: params.id } },
  });
  if (!existing) {
    await prisma.groupMember.create({ data: { userId: targetUserId, groupId: params.id } });
  }
  return NextResponse.json({ ok: true });
}

// DELETE /api/groups/[id]/members — owner removes a member
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any).id;

  const membership = await getMembership(userId, params.id);
  if (!membership || membership.role !== 'owner') {
    return NextResponse.json({ error: 'Only the group owner can remove members' }, { status: 403 });
  }

  const { targetUserId } = await req.json();
  if (!targetUserId) return NextResponse.json({ error: 'User required' }, { status: 400 });

  const target = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: targetUserId, groupId: params.id } },
    select: { role: true },
  });
  if (!target) return NextResponse.json({ error: 'User is not a member' }, { status: 404 });
  if (target.role === 'owner') {
    return NextResponse.json({ error: 'Cannot remove the group owner' }, { status: 400 });
  }

  await prisma.groupMember.delete({
    where: { userId_groupId: { userId: targetUserId, groupId: params.id } },
  });
  return NextResponse.json({ ok: true });
}
