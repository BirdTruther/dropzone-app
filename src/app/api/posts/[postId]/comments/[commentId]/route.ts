// DELETED — moved to src/app/api/posts/[id]/comments/[commentId]/route.ts
import { NextResponse } from 'next/server';
export async function DELETE() { return NextResponse.json({ error: 'Not found' }, { status: 404 }); }
