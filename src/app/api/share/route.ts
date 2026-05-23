import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';

const FACEBOOK_HOSTS = ['facebook.com', 'm.facebook.com', 'fb.watch'];

function isFacebookUrl(url: string | null): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.replace('www.', '');
    return FACEBOOK_HOSTS.includes(host);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { postId } = await req.json();
  if (!postId) return NextResponse.json({ error: 'Missing postId' }, { status: 400 });

  // Verify the post exists and user is a member of the group
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { group: { include: { members: true } } },
  });
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

  const userId = (session.user as any).id;
  const isMember = post.group.members.some((m: any) => m.userId === userId);
  if (!isMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Reuse existing token if one exists for this post
  const existing = await prisma.shareToken.findFirst({ where: { postId } });
  if (existing) {
    const url = `${process.env.NEXTAUTH_URL}/share/${existing.token}`;
    return NextResponse.json({ url });
  }

  const shareToken = await prisma.shareToken.create({ data: { postId } });
  const url = `${process.env.NEXTAUTH_URL}/share/${shareToken.token}`;

  // If this is a Facebook post and the video hasn't been downloaded yet,
  // kick off a background download so it's ready when the share link is opened.
  if (isFacebookUrl(post.url)) {
    const hash = crypto.createHash('sha256').update(post.url!).digest('hex').slice(0, 16);
    const outPath = path.join(process.cwd(), 'public', 'uploads', `fb_${hash}.mp4`);
    if (!existsSync(outPath)) {
      // Fire and forget — don't await, don't block the response
      const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
      fetch(`${baseUrl}/api/fetch-facebook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': process.env.INTERNAL_API_SECRET ?? '',
        },
        body: JSON.stringify({ url: post.url }),
      }).catch((err) => {
        console.error('[share] background Facebook pre-download failed:', err);
      });
    }
  }

  return NextResponse.json({ url });
}
