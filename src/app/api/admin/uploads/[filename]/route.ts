import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function DELETE(_req: Request, { params }: { params: { filename: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (user?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

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
