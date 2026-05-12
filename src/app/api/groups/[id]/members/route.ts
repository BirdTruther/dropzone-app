import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/groups/[id]/members — returns group members for @mention autocomplete
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as any).id;

  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId: params.id } },
  });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const members = await prisma.groupMember.findMany({
    where: { groupId: params.id },
    select: {
      user: { select: { id: true, name: true, avatar: true } },
    },
  });

  return NextResponse.json(members.map(m => m.user));
}
