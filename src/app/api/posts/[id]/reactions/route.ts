import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { emoji } = await req.json();
  if (!emoji) return NextResponse.json({ error: 'Emoji required' }, { status: 400 });
  const existing = await prisma.reaction.findUnique({
    where: { userId_postId_emoji: { userId: session.user.id, postId: params.id, emoji } },
  });
  if (existing) {
    await prisma.reaction.delete({ where: { id: existing.id } });
    return NextResponse.json({ removed: true });
  }
  const reaction = await prisma.reaction.create({
    data: { emoji, userId: session.user.id, postId: params.id },
  });
  return NextResponse.json(reaction);
}
