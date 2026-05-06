import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';

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
  const filename = params.filename.replace(/[^a-zA-Z0-9._-]/g, '');
  if (!filename) return new NextResponse('Not found', { status: 404 });

  const filePath = join(process.cwd(), 'public', 'uploads', filename);

  try {
    const file = await readFile(filePath);
    const ext = extname(filename).toLowerCase();
    const mimeType = MIME[ext] ?? 'application/octet-stream';
    return new NextResponse(file, {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=86400',
        'Content-Length': file.length.toString(),
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
