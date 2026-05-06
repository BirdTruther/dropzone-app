import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { unlink } from 'fs/promises';
import { join } from 'path';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const post = await prisma.post.findUnique({ where: { id: params.id } });
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

  // Only the author can delete their own post
  if (post.authorId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Delete the uploaded file if there is one
  if (post.uploadUrl) {
    try {
      const filename = post.uploadUrl.replace('/api/uploads/', '');
      await unlink(join(process.cwd(), 'public', 'uploads', filename));
    } catch { /* file may already be gone */ }
  }

  await prisma.post.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true });
}
