import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createReadStream, statSync, existsSync } from 'fs';
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

export async function GET(
  req: NextRequest,
  { params }: { params: { filename: string } }
) {
  // --- Auth guard: uploads are private to logged-in users ---
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Strip everything except alphanumeric, dot, underscore, hyphen
  const filename = params.filename.replace(/[^a-zA-Z0-9._-]/g, '');
  if (!filename) return new Response('Not found', { status: 404 });

  const uploadsDir = join(process.cwd(), 'public', 'uploads');
  const filePath = join(uploadsDir, filename);

  // --- Path traversal guard ---
  if (!filePath.startsWith(uploadsDir + sep)) {
    return new Response('Forbidden', { status: 403 });
  }

  if (!existsSync(filePath)) return new Response('Not found', { status: 404 });

  const ext = extname(filename).toLowerCase();
  const mimeType = MIME[ext] ?? 'application/octet-stream';
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
        'Content-Type': mimeType,
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Content-Length': String(chunkSize),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, max-age=86400',
      },
    });
  }

  // Full file (no Range header)
  const stream = createReadStream(filePath);
  const webStream = Readable.toWeb(stream) as ReadableStream;

  return new Response(webStream, {
    status: 200,
    headers: {
      'Content-Type': mimeType,
      'Content-Length': String(size),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=86400',
    },
  });
}
