import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateJoinCode } from '@/lib/joinCode';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const groups = await prisma.groupMember.findMany({
    where: { userId: session.user.id },
    include: { group: { include: { _count: { select: { members: true, posts: true } } } } },
    orderBy: { joinedAt: 'desc' },
  });
  return NextResponse.json(groups.map(m => ({ ...m.group, role: m.role })));
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { name, description, emoji } = await req.json();
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  let group: Awaited<ReturnType<typeof prisma.group.create>> | null = null;
  for (let attempt = 0; attempt < 5 && !group; attempt++) {
    try {
      group = await prisma.group.create({
        data: {
          name,
          description: description ?? null,
          emoji: emoji ?? '🔗',
          joinCode: generateJoinCode(),
          members: { create: { userId: session.user.id, role: 'owner' } },
        },
      });
    } catch (e: any) {
      // Collision on the unique joinCode — retry with a fresh code
      if (e?.code === 'P2002') continue;
      throw e;
    }
  }
  if (!group) return NextResponse.json({ error: 'Could not create group' }, { status: 500 });
  return NextResponse.json(group, { status: 201 });
}
