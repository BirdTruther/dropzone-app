import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const share = await prisma.shareToken.findUnique({
    where: { token: params.token },
    include: {
      post: {
        include: { author: { select: { name: true, avatar: true } } },
      },
    },
  });

  if (!share) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (share.expiresAt && share.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Link expired' }, { status: 410 });
  }

  return NextResponse.json(share.post);
}
