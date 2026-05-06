import { NextRequest, NextResponse } from 'next/server';
import { fetchLinkPreview } from '@/lib/og';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'No URL' }, { status: 400 });
  const data = await fetchLinkPreview(url);
  return NextResponse.json(data);
}
