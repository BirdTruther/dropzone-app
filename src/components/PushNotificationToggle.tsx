'use client';
import { useEffect, useState } from 'react';

export default function PushNotificationToggle() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isSupported = 'serviceWorker' in navigator && 'PushManager' in window;
    setSupported(isSupported);
    if (!isSupported) return;

    setPermission(Notification.permission);

    // Register SW and check if already subscribed
    navigator.serviceWorker.register('/sw.js').then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setSubscribed(!!sub);
    });
  }, []);

  async function enable() {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') { setLoading(false); return; }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // VAPID public key — replace with your own from: npx web-push generate-vapid-keys
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
        ),
      });

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
      setSubscribed(true);
    } catch (err) {
      console.error('Push subscription failed:', err);
    }
    setLoading(false);
  }

  async function disable() {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch (err) {
      console.error('Unsubscribe failed:', err);
    }
    setLoading(false);
  }

  if (!supported) return null;
  if (permission === 'denied') {
    return (
      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', padding: '0.5rem 0' }}>
        🔕 Push notifications blocked in browser settings.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.75rem 0', borderTop: '1px solid var(--color-border)' }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Push Notifications</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
          {subscribed ? 'You\'ll get notified even when the tab is closed.' : 'Get notified about reactions and new drops.'}
        </div>
      </div>
      <button
        onClick={subscribed ? disable : enable}
        disabled={loading}
        style={{
          flexShrink: 0,
          padding: '0.4rem 0.85rem',
          borderRadius: 'var(--radius-full)',
          fontSize: '0.8rem',
          fontWeight: 600,
          cursor: loading ? 'wait' : 'pointer',
          border: subscribed ? '1px solid var(--color-border)' : '1px solid var(--color-primary)',
          background: subscribed ? 'var(--color-surface-2)' : 'var(--color-primary)',
          color: subscribed ? 'var(--color-text-muted)' : '#fff',
          transition: 'all 0.15s',
        }}
      >
        {loading ? '...' : subscribed ? 'Turn Off' : 'Enable'}
      </button>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}
