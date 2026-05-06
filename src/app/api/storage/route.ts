import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUploadsSize, MAX_VOLUME_SIZE, formatBytes } from '@/lib/storage';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const used = await getUploadsSize();
  const total = MAX_VOLUME_SIZE;
  const percent = Math.round((used / total) * 100);

  return NextResponse.json({
    used,
    total,
    percent,
    usedFormatted: formatBytes(used),
    totalFormatted: formatBytes(total),
  });
}
