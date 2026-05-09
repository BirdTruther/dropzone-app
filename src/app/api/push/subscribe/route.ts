import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST /api/push/subscribe — save a push subscription for the current user
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const subscription = await req.json();
  if (!subscription?.endpoint) return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });

  await prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    create: {
      userId: session.user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys?.p256dh ?? '',
      auth: subscription.keys?.auth ?? '',
    },
    update: {
      userId: session.user.id,
      p256dh: subscription.keys?.p256dh ?? '',
      auth: subscription.keys?.auth ?? '',
    },
  });

  return NextResponse.json({ ok: true });
}

// DELETE /api/push/subscribe — remove push subscription
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { endpoint } = await req.json();
  if (!endpoint) return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 });

  await prisma.pushSubscription.deleteMany({
    where: { userId: session.user.id, endpoint },
  });

  return NextResponse.json({ ok: true });
}
