import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: user.id, groupId: params.id } },
  });

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'Only group owners or admins can edit this group' }, { status: 403 });
  }

  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (body.name?.trim()) updates.name = body.name.trim();
  if (body.emoji?.trim()) updates.emoji = body.emoji.trim();
  if (body.description !== undefined) updates.description = body.description.trim();
  // Only owner can toggle openInvite
  if (body.openInvite !== undefined && membership.role === 'owner') {
    updates.openInvite = Boolean(body.openInvite);
  }

  const updated = await prisma.group.update({ where: { id: params.id }, data: updates });
  return NextResponse.json(updated);
}
