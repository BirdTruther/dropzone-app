'use client';
import { useEffect } from 'react';
import { useSession } from 'next-auth/react';

/**
 * PushInit — mounts invisibly inside <Providers>.
 *
 * On first authenticated load it:
 *   1. Registers /sw.js as the service worker (idempotent — safe to call every load)
 *   2. Checks whether a push subscription already exists for this device
 *   3. If not, calls PushManager.subscribe() and POSTs the result to
 *      /api/push/subscribe so the server can send VAPID pushes to this device
 *
 * Note: applicationServerKey accepts a string (base64url) directly — no
 * Uint8Array conversion required. This avoids the ArrayBufferLike vs
 * ArrayBuffer type incompatibility under strict TypeScript + es5 target.
 *
 * Requirements:
 *   - NEXT_PUBLIC_VAPID_PUBLIC_KEY must be set in the environment at build time
 *   - The browser must support serviceWorker + PushManager (all modern browsers;
 *     iOS 16.4+ requires the app to be installed as a PWA / added to home screen)
 *   - The user must be signed in (checked via useSession)
 */
export default function PushInit() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) return;

    let cancelled = false;

    (async () => {
      try {
        await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        const reg = await navigator.serviceWorker.ready;

        if (cancelled) return;

        const existing = await reg.pushManager.getSubscription();
        if (existing) return;

        if (Notification.permission === 'denied') return;
        if (Notification.permission === 'default') {
          const result = await Notification.requestPermission();
          if (result !== 'granted') return;
        }

        // Pass the VAPID public key as a plain string — the PushManager API
        // accepts base64url strings directly (same as Uint8Array), and this
        // avoids the Uint8Array<ArrayBufferLike> type error under strict TS.
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKey,
        });

        if (cancelled) return;

        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sub.toJSON()),
        });
      } catch {
        // non-fatal
      }
    })();

    return () => { cancelled = true; };
  }, [status, session]);

  return null;
}
