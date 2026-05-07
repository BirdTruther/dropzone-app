import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-static';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'CHANGELOG.md');
    const raw = fs.readFileSync(filePath, 'utf-8');

    // Parse into structured releases
    const releases: { version: string; date: string; items: string[] }[] = [];
    let current: { version: string; date: string; items: string[] } | null = null;

    for (const line of raw.split('\n')) {
      const heading = line.match(/^## (v[\d.]+)[\s\u2014-]+(.+)/);
      if (heading) {
        if (current) releases.push(current);
        current = { version: heading[1], date: heading[2].trim(), items: [] };
      } else if (current && line.startsWith('- ')) {
        current.items.push(line.slice(2).trim());
      }
    }
    if (current) releases.push(current);

    return NextResponse.json(releases);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
