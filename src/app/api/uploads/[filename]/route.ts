import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { lookup } from 'mime-types';

export async function GET(
  req: NextRequest,
  { params }: { params: { filename: string } }
) {
  // Prevent path traversal attacks
  const filename = params.filename.replace(/[^a-zA-Z0-9._-]/g, '');
  if (!filename) return new NextResponse('Not found', { status: 404 });

  const filePath = join(process.cwd(), 'public', 'uploads', filename);

  try {
    const file = await readFile(filePath);
    const mimeType = lookup(filename) || 'application/octet-stream';
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
