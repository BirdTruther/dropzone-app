import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { inviteCode, publicGroupId } = await req.json();

  let group = null;
  if (publicGroupId) {
    group = await prisma.group.findUnique({ where: { id: publicGroupId } });
    if (!group || !group.isPublic) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }
  } else if (inviteCode) {
    group = await prisma.group.findUnique({ where: { inviteCode } });
    if (!group) return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 });
  } else {
    return NextResponse.json({ error: 'Missing invite code' }, { status: 400 });
  }

  const existing = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId: group.id } },
  });
  if (existing) return NextResponse.json(group);
  await prisma.groupMember.create({ data: { userId: session.user.id, groupId: group.id } });
  return NextResponse.json(group);
}
