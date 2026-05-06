import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 });

  try {
    const res = await fetch(
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 3600 } }
    );
    if (!res.ok) return NextResponse.json({ error: 'oEmbed failed' }, { status: 502 });
    const data = await res.json();

    // Extract video ID from embed_product_id or from html
    let videoId: string | null = data.embed_product_id ?? null;
    if (!videoId && data.html) {
      const match = data.html.match(/\/video\/(\d+)/);
      if (match) videoId = match[1];
    }

    return NextResponse.json({
      videoId,
      thumbnail: data.thumbnail_url ?? null,
      title: data.title ?? null,
      author: data.author_name ?? null,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch oEmbed' }, { status: 502 });
  }
}
