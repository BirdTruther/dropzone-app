import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { unlink } from 'fs/promises';
import { join } from 'path';

// Optional cleanup endpoint — only deletes posts that have an explicit expiresAt set.
// By default, uploads and posts are kept forever. This endpoint is a no-op unless
// a post was manually given an expiry date.
// e.g. GET https://localhost:8742/api/cleanup?secret=YOUR_SECRET
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (secret !== (process.env.CLEANUP_SECRET ?? 'dropzone-cleanup')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only target posts that have a non-null expiresAt that has already passed
  const expired = await prisma.post.findMany({
    where: {
      expiresAt: {
        not: null,
        lt: new Date(),
      },
      uploadUrl: { not: null },
    },
  });

  let deleted = 0;
  for (const post of expired) {
    if (post.uploadUrl) {
      try {
        await unlink(join(process.cwd(), 'public', 'uploads', post.uploadUrl.replace('/api/uploads/', '')));
      } catch {
        // file already gone, ignore
      }
    }
    await prisma.post.delete({ where: { id: post.id } });
    deleted++;
  }

  return NextResponse.json({ deleted, message: `Cleaned up ${deleted} expired posts` });
}
