import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { unlink } from 'fs/promises';
import { join } from 'path';

// Call this endpoint periodically to clean up expired uploads
// e.g. add a cron in Cosmos/cron job: GET https://localhost:8742/api/cleanup?secret=YOUR_SECRET
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (secret !== (process.env.CLEANUP_SECRET ?? 'dropzone-cleanup')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const expired = await prisma.post.findMany({
    where: { expiresAt: { lt: new Date() }, uploadUrl: { not: null } },
  });

  let deleted = 0;
  for (const post of expired) {
    if (post.uploadUrl) {
      try {
        await unlink(join(process.cwd(), 'public', post.uploadUrl));
      } catch {
        // file already gone, ignore
      }
    }
    await prisma.post.delete({ where: { id: post.id } });
    deleted++;
  }

  return NextResponse.json({ deleted, message: `Cleaned up ${deleted} expired posts` });
}
