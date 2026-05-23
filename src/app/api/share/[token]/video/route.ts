// Public token-gated video streaming route.
// Validates the share token (no session required) and streams the
// associated Facebook-downloaded mp4 so unauthenticated share page
// visitors can play the video.
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { existsSync, statSync, createReadStream } from 'fs';
import { join, sep } from 'path';
import { Readable } from 'stream';
import crypto from 'crypto';

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const token = params.token?.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!token) return new Response('Not found', { status: 404 });

  // Validate share token
  const share = await prisma.shareToken.findUnique({
    where: { token },
    include: { post: { select: { url: true, uploadUrl: true, uploadType: true } } },
  });

  if (!share) return new Response('Not found', { status: 404 });
  if (share.expiresAt && share.expiresAt < new Date()) {
    return new Response('Share link has expired', { status: 410 });
  }

  const post = share.post;

  // Determine the file to stream:
  // - Facebook videos are stored as fb_<hash>.mp4 derived from the post URL
  // - Uploaded videos use uploadUrl directly
  let filename: string | null = null;

  const isFacebook = (() => {
    if (!post.url) return false;
    try {
      const host = new URL(post.url).hostname.replace('www.', '');
      return ['facebook.com', 'm.facebook.com', 'fb.watch'].includes(host);
    } catch { return false; }
  })();

  if (isFacebook && post.url) {
    const hash = crypto.createHash('sha256').update(post.url).digest('hex').slice(0, 16);
    filename = `fb_${hash}.mp4`;
  } else if (post.uploadType === 'video' && post.uploadUrl) {
    filename = post.uploadUrl.split('/').pop() ?? null;
  }

  if (!filename) return new Response('No video associated with this post', { status: 404 });

  const uploadsDir = join(process.cwd(), 'public', 'uploads');
  const filePath = join(uploadsDir, filename.replace(/[^a-zA-Z0-9._-]/g, ''));

  if (!filePath.startsWith(uploadsDir + sep)) {
    return new Response('Forbidden', { status: 403 });
  }

  if (!existsSync(filePath)) {
    // File doesn't exist yet — still processing
    return new Response(JSON.stringify({ processing: true }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { size } = statSync(filePath);
  const rangeHeader = req.headers.get('range');

  if (rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (!match) return new Response('Invalid range', { status: 416 });

    const start = parseInt(match[1], 10);
    const end = match[2] ? parseInt(match[2], 10) : Math.min(start + 1024 * 1024 - 1, size - 1);

    if (start >= size || end >= size) {
      return new Response('Range Not Satisfiable', {
        status: 416,
        headers: { 'Content-Range': `bytes */${size}` },
      });
    }

    const chunkSize = end - start + 1;
    const stream = createReadStream(filePath, { start, end });
    const webStream = Readable.toWeb(stream) as ReadableStream;

    return new Response(webStream, {
      status: 206,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Content-Length': String(chunkSize),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  }

  const stream = createReadStream(filePath);
  const webStream = Readable.toWeb(stream) as ReadableStream;

  return new Response(webStream, {
    status: 200,
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(size),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
