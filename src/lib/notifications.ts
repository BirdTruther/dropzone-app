import { prisma } from '@/lib/prisma';
import { sendPushToUser } from '@/lib/sendPush';

export async function createNotification({
  userId,
  type,
  message,
  link,
  actorName,
  actorAvatar,
}: {
  userId: string;
  type: string;
  message: string;
  link?: string;
  actorName?: string;
  actorAvatar?: string;
}) {
  try {
    await prisma.notification.create({
      data: {
        userId,
        type,
        message,
        link: link ?? null,
        actorName: actorName ?? null,
        actorAvatar: actorAvatar ?? null,
      },
    });

    // Fire-and-forget push — never block or throw on the main request
    sendPushToUser(userId, {
      title: 'dropzone',
      body: message,
      url: link ?? '/notifications',
    }).catch(() => {});
  } catch {
    // Non-fatal — never let a notification error break the main action
  }
}
