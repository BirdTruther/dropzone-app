import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

async function requireSiteAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user?.isSiteAdmin) return null;
  return user;
}

export async function DELETE(_req: Request, { params }: { params: { filename: string } }) {
  const admin = await requireSiteAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const filename = params.filename.replace(/[^a-zA-Z0-9._-]/g, '');
  const uploadsDir = join(process.cwd(), 'public', 'uploads');
  const filePath = join(uploadsDir, filename);

  if (!filePath.startsWith(uploadsDir)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }
  if (!existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  await unlink(filePath);
  return NextResponse.json({ ok: true });
}
