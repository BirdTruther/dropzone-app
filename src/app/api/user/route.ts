import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

const PREF_FIELDS = [
  'notifyPushNewDrop', 'notifyPushReaction', 'notifyPushComment', 'notifyPushMention',
  'notifyInAppNewDrop', 'notifyInAppReaction', 'notifyInAppComment', 'notifyInAppMention',
] as const;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: Object.fromEntries(PREF_FIELDS.map(f => [f, true])) as any,
  });
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(user);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { name, email, avatar, currentPassword, newPassword } = body;

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const updates: Record<string, any> = {};

  if (name?.trim()) updates.name = name.trim();
  if (avatar !== undefined) updates.avatar = avatar;

  if (email?.trim() && email.trim() !== user.email) {
    const exists = await prisma.user.findUnique({ where: { email: email.trim() } });
    if (exists) return NextResponse.json({ error: 'Email already in use' }, { status: 400 });
    updates.email = email.trim();
  }

  if (newPassword) {
    if (!currentPassword) return NextResponse.json({ error: 'Current password required' }, { status: 400 });
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
    updates.password = await bcrypt.hash(newPassword, 12);
  }

  // Handle notification preference updates
  for (const field of PREF_FIELDS) {
    if (typeof body[field] === 'boolean') updates[field] = body[field];
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: updates,
    select: { id: true, name: true, email: true, avatar: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { password } = await req.json();
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return NextResponse.json({ error: 'Incorrect password' }, { status: 400 });

  await prisma.user.delete({ where: { id: user.id } });
  return NextResponse.json({ success: true });
}
