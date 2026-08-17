import { prisma } from '@/lib/prisma';
import { sendPushToUser } from '@/lib/sendPush';

export async function notifyGroupMembers({
  groupId,
  actorId,
  type,
  message,
}: {
  groupId: string;
  actorId: string;
  type: string;
  message: string;
}) {
  const group = await prisma.group.findUnique({ where: { id: groupId }, select: { name: true, emoji: true } });
  const allMembers = await prisma.groupMember.findMany({
    where: { groupId, userId: { not: actorId } },
    select: { userId: true },
  });
  const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { name: true, avatar: true } });

  await Promise.all(
    allMembers.map(m =>
      createNotification({
        userId: m.userId,
        type,
        message: `${actor?.name ?? 'Someone'} ${message} in ${group?.emoji ?? ''} ${group?.name ?? 'a group'}`,
        link: `/groups/${groupId}`,
        actorName: actor?.name ?? undefined,
        actorAvatar: actor?.avatar ?? undefined,
      })
    )
  );
}

// Map notification type to the User preference field names
const PREF_MAP: Record<string, { inApp: string; push: string }> = {
  new_post: { inApp: 'notifyInAppNewDrop',  push: 'notifyPushNewDrop' },
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
