import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // Only allow admins/creators to edit
  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: user.id, groupId: params.id } },
  });
  if (!membership || membership.role !== 'admin') {
    return NextResponse.json({ error: 'Only group admins can edit this group' }, { status: 403 });
  }

  const { name, emoji, description } = await req.json();
  const updates: Record<string, string> = {};
  if (name?.trim()) updates.name = name.trim();
  if (emoji?.trim()) updates.emoji = emoji.trim();
  if (description !== undefined) updates.description = description.trim();

  const updated = await prisma.group.update({
    where: { id: params.id },
    data: updates,
  });

  return NextResponse.json(updated);
}
