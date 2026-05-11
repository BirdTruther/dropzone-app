// DELETED — moved to src/app/api/posts/[id]/comments/route.ts
// This file intentionally left as a redirect stub to avoid build conflicts.
// Next.js requires a valid export, so we re-export a 404 handler.
import { NextResponse } from 'next/server';
export async function GET() { return NextResponse.json({ error: 'Not found' }, { status: 404 }); }
export async function POST() { return NextResponse.json({ error: 'Not found' }, { status: 404 }); }
