// Public token-gated media proxy.
// Serves uploaded images and videos associated with a share token
// WITHOUT requiring a session — this allows Discord, iMessage, and
// other link-preview scrapers to fetch the og:image / og:video URLs.
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { existsSync, statSync, createReadStream } from 'fs';
import { join, extname, sep } from 'path';
import { Readable } from 'stream';

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
};

// Shared validation for GET and HEAD — resolves and checks the share token
// and file path without touching the filesystem stream.
async function resolveShareMedia(
  params: { token: string }
): Promise<Response | { filePath: string; mimeType: string; size: number }> {
  const token = params.token?.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!token) return new Response('Not found', { status: 404 });

  // Validate share token — no session needed, token IS the auth
  const share = await prisma.shareToken.findUnique({
    where: { token },
    include: { post: { select: { uploadUrl: true, uploadType: true } } },
  });

  if (!share) return new Response('Not found', { status: 404 });
  if (share.expiresAt && share.expiresAt < new Date()) {
    return new Response('Share link has expired', { status: 410 });
  }

  const post = share.post;

  // Only handle uploaded images and videos
  if (!post.uploadUrl || !post.uploadType) {
    return new Response('No media associated with this post', { status: 404 });
  }

  // Derive filename from uploadUrl (e.g. /uploads/abc123.mp4 -> abc123.mp4)
  const rawFilename = post.uploadUrl.split('/').pop() ?? '';
  const filename = rawFilename.replace(/[^a-zA-Z0-9._-]/g, '');
  if (!filename) return new Response('Not found', { status: 404 });

  const uploadsDir = join(process.cwd(), 'public', 'uploads');
  const filePath = join(uploadsDir, filename);

  // Path traversal guard
  if (!filePath.startsWith(uploadsDir + sep)) {
    return new Response('Forbidden', { status: 403 });
  }

  if (!existsSync(filePath)) return new Response('Not found', { status: 404 });

  const ext = extname(filename).toLowerCase();
  const mimeType = MIME[ext] ?? 'application/octet-stream';
  const { size } = statSync(filePath);

  return { filePath, mimeType, size };
}

// HEAD — Discord/iMessage/etc. link-preview scrapers send this before
// fetching the body. It must NOT create a filesystem read stream: piping a
// Node fs stream into a Response whose body Next.js then discards (as it
// does for HEAD) throws "Controller is already closed" once the stream
// emits data after the web-stream side has been closed.
export async function HEAD(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const resolved = await resolveShareMedia(params);
  if (resolved instanceof Response) return resolved;

  return new Response(null, {
    status: 200,
    headers: {
      'Content-Type': resolved.mimeType,
      'Content-Length': String(resolved.size),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const resolved = await resolveShareMedia(params);
  if (resolved instanceof Response) return resolved;
  const { filePath, mimeType, size } = resolved;

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
        'Content-Type': mimeType,
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Content-Length': String(chunkSize),
        'Accept-Ranges': 'bytes',
        // public so Discord/iMessage CDNs can cache the embed media
        'Cache-Control': 'public, max-age=86400',
      },
    });
  }

  const stream = createReadStream(filePath);
  const webStream = Readable.toWeb(stream) as ReadableStream;

  return new Response(webStream, {
    status: 200,
    headers: {
      'Content-Type': mimeType,
      'Content-Length': String(size),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
