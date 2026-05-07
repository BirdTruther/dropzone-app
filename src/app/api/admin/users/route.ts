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

// GET — list all users
export async function GET() {
  const admin = await requireSiteAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, avatar: true, isSiteAdmin: true, createdAt: true,
      _count: { select: { posts: true, memberships: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(users);
}

// DELETE — delete a user account
export async function DELETE(req: NextRequest) {
  const admin = await requireSiteAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { userId } = await req.json();
  if (userId === admin.id) return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });

  await prisma.user.delete({ where: { id: userId } });
  return NextResponse.json({ ok: true });
}

// PATCH — toggle isSiteAdmin
export async function PATCH(req: NextRequest) {
  const admin = await requireSiteAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { userId, isSiteAdmin } = await req.json();
  if (userId === admin.id) return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 });

  const updated = await prisma.user.update({ where: { id: userId }, data: { isSiteAdmin } });
  return NextResponse.json({ ok: true, isSiteAdmin: updated.isSiteAdmin });
}
