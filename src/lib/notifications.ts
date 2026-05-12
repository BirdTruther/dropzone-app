import { prisma } from '@/lib/prisma';
import { sendPushToUser } from '@/lib/sendPush';

// Map notification type to the User preference field names
const PREF_MAP: Record<string, { inApp: string; push: string }> = {
  drop:     { inApp: 'notifyInAppNewDrop',  push: 'notifyPushNewDrop' },
  reaction: { inApp: 'notifyInAppReaction', push: 'notifyPushReaction' },
  comment:  { inApp: 'notifyInAppComment',  push: 'notifyPushComment' },
  mention:  { inApp: 'notifyInAppMention',  push: 'notifyPushMention' },
};

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
    const prefs = PREF_MAP[type];

    // Fetch user prefs if we have a known type
    let inAppEnabled = true;
    let pushEnabled = true;

    if (prefs) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          [prefs.inApp]: true,
          [prefs.push]: true,
        } as any,
      });
      if (user) {
        inAppEnabled = (user as any)[prefs.inApp] ?? true;
        pushEnabled  = (user as any)[prefs.push]  ?? true;
      }
    }

    if (inAppEnabled) {
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
    }

    if (pushEnabled) {
      sendPushToUser(userId, {
        title: 'dropzone',
        body: message,
        url: link ?? '/notifications',
      }).catch(() => {});
    }
  } catch {
    // Non-fatal — never let a notification error break the main action
  }
}
