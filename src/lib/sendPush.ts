import webpush from 'web-push';
import { prisma } from '@/lib/prisma';

if (
  process.env.VAPID_MAILTO &&
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
  process.env.VAPID_PRIVATE_KEY
) {
  webpush.setVapidDetails(
    process.env.VAPID_MAILTO,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url: string }
) {
  // Skip if VAPID keys aren't configured
  if (!process.env.VAPID_PRIVATE_KEY) return;

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return;

  const message = JSON.stringify(payload);

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          message
        );
      } catch (err: unknown) {
        // 410 Gone = expired/revoked; 404 = not found — both mean the subscription
        // is gone on the browser side and should be purged from the DB.
        if (
          typeof err === 'object' &&
          err !== null &&
          'statusCode' in err
        ) {
          const { statusCode } = err as { statusCode: number };
          if (statusCode === 410 || statusCode === 404) {
            console.log(`[sendPush] Cleaning up stale subscription (HTTP ${statusCode}) for user ${userId}, endpoint: ${sub.endpoint.slice(0, 40)}…`);
            await prisma.pushSubscription.deleteMany({
              where: { endpoint: sub.endpoint },
            });
          }
        }
      }
    })
  );
}
