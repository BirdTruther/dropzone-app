'use client';
import { useEffect } from 'react';
import { useSession } from 'next-auth/react';

/** Convert a URL-safe base64 VAPID public key to a Uint8Array for PushManager.subscribe() */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

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
 *   - NEXT_PUBLIC_VAPID_PUBLIC_KEY must be set in the environment at build time
 *   - The browser must support serviceWorker + PushManager (all modern browsers;
 *     iOS 16.4+ requires the app to be installed as a PWA / added to home screen)
 *   - The user must be signed in (checked via useSession)
 */
export default function PushInit() {
  const { data: session, status } = useSession();

  useEffect(() => {
    // Wait until session is resolved and user is authenticated
    if (status !== 'authenticated' || !session?.user) return;

    // Browser support check
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) return;

    let cancelled = false;

    (async () => {
      try {
        // 1. Register the service worker (no-op if already registered)
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

        // Wait for the SW to be active before trying to subscribe
        await navigator.serviceWorker.ready;

        if (cancelled) return;

        // 2. Check for an existing subscription on this device
        const existing = await reg.pushManager.getSubscription();
        if (existing) return; // already subscribed — nothing to do

        // 3. Request permission if not already granted
        if (Notification.permission === 'denied') return;
        if (Notification.permission === 'default') {
          const result = await Notification.requestPermission();
          if (result !== 'granted') return;
        }

        // 4. Create a new push subscription
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });

        if (cancelled) return;

        // 5. Persist the subscription on the server
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sub.toJSON()),
        });
      } catch {
        // SW registration or subscribe failed — non-fatal, no-op
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, session]);

  return null;
}
