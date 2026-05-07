import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function requireSiteAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user?.isSiteAdmin) return null;
  return user;
}

// GET — list recent posts across all groups
export async function GET() {
  const admin = await requireSiteAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const posts = await prisma.post.findMany({
    take: 100,
    orderBy: { createdAt: 'desc' },
    include: {
      author: { select: { id: true, name: true, email: true } },
      group: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json(posts);
}

// DELETE — delete any post
export async function DELETE(req: NextRequest) {
  const admin = await requireSiteAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { postId } = await req.json();
  await prisma.post.delete({ where: { id: postId } });
  return NextResponse.json({ ok: true });
}
