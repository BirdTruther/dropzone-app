'use client';
import { useEffect } from 'react';
import { useSession } from 'next-auth/react';

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

// Detects a subscription created under a since-rotated VAPID keypair. The
// browser reports the old subscription as "existing" regardless — it has no
// way to know the server's key changed — so without this check a rotated
// VAPID key permanently orphans every previously-subscribed device.
function subscriptionKeyMatches(existing: PushSubscription, currentKey: Uint8Array): boolean {
  const existingKey = existing.options.applicationServerKey;
  if (!existingKey) return false;
  const existingBytes = new Uint8Array(existingKey);
  if (existingBytes.length !== currentKey.length) return false;
  return existingBytes.every((byte, i) => byte === currentKey[i]);
}

export const PUSH_MIGRATION_FLAG = 'dz_push_migrated';

/**
 * PushInit — mounts invisibly inside <Providers>.
 *
 * On first authenticated load it:
 *   1. Registers /sw.js as the service worker (idempotent — safe to call every load)
 *   2. Checks whether a push subscription already exists for this device
 *   3. If not, calls PushManager.subscribe() and POSTs the result to
 *      /api/push/subscribe so the server can send VAPID pushes to this device
 *
 * Requirements:
 *   - NEXT_PUBLIC_VAPID_PUBLIC_KEY must be set as a Docker build-arg (ARG in Dockerfile)
 *     AND passed via build-args in the GitHub Actions workflow.
 *   - The browser must support serviceWorker + PushManager (all modern browsers;
 *     iOS 16.4+ requires the app to be installed as a PWA / added to home screen)
 *   - The user must be signed in (checked via useSession)
 */
export default function PushInit() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('[PushInit] serviceWorker or PushManager not supported');
      return;
    }

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      console.error('[PushInit] NEXT_PUBLIC_VAPID_PUBLIC_KEY is undefined — was it set as a Docker build-arg?');
      return;
    }
    console.log('[PushInit] VAPID key present, starting registration…');

    let cancelled = false;

    (async () => {
      try {
        await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        console.log('[PushInit] SW registered');

        const reg = await navigator.serviceWorker.ready;
        console.log('[PushInit] SW ready');
        if (cancelled) return;

        const currentKeyBytes = urlBase64ToUint8Array(vapidKey);
        const existing = await reg.pushManager.getSubscription();
        if (existing) {
          if (subscriptionKeyMatches(existing, currentKeyBytes)) {
            console.log('[PushInit] Existing subscription found, skipping');
            return;
          }
          // Stale subscription from a rotated VAPID key — the browser can't
          // detect this itself, so tear it down and re-subscribe under the
          // current key. Permission is already granted at this point, so
          // this happens silently with no re-prompt.
          console.log('[PushInit] Existing subscription uses an outdated VAPID key, migrating…');
          await existing.unsubscribe();
          try {
            localStorage.setItem(PUSH_MIGRATION_FLAG, '1');
          } catch { /* private browsing / storage disabled — non-fatal */ }
        }

        if (Notification.permission === 'denied') {
          console.log('[PushInit] Notification permission denied');
          return;
        }
        if (Notification.permission === 'default') {
          const result = await Notification.requestPermission();
          console.log('[PushInit] Permission result:', result);
          if (result !== 'granted') return;
        }

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: currentKeyBytes,
        });
        console.log('[PushInit] Subscribed:', sub.endpoint);
        if (cancelled) return;

        const res = await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sub.toJSON()),
        });
        console.log('[PushInit] POST /api/push/subscribe →', res.status);
      } catch (err) {
        console.error('[PushInit] Error during push setup:', err);
      }
    })();

    return () => { cancelled = true; };
  }, [status, session]);

  return null;
}
