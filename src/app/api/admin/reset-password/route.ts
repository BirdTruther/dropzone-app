import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!admin?.isSiteAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { userId, newPassword } = await req.json();
  if (!userId || !newPassword || newPassword.length < 6)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const hashed = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: userId }, data: { password: hashed } });

  return NextResponse.json({ ok: true });
}
