import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/groups/invite/[code] — public invite-link preview.
// No auth required: the invite code itself is the access token.
// Accepts either the long inviteCode or the short 8-character joinCode.
export async function GET(
  _req: NextRequest,
  { params }: { params: { code: string } }
) {
  const group = await prisma.group.findFirst({
    where: { OR: [{ inviteCode: params.code }, { joinCode: params.code }] },
    include: { _count: { select: { members: true } } },
  });
  if (!group) return NextResponse.json({ error: 'Invalid invite' }, { status: 404 });

  return NextResponse.json({
    id: group.id,
    name: group.name,
    emoji: group.emoji,
    description: group.description,
    memberCount: group._count.members,
  });
}
