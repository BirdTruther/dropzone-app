'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

export default function Header() {
  const { data: session } = useSession();
  const user = session?.user as { name?: string | null; email?: string | null; image?: string | null } | undefined;
  const [isSiteAdmin, setIsSiteAdmin] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    fetch('/api/admin/users')
      .then(r => r.ok ? setIsSiteAdmin(true) : null)
      .catch(() => {});
  }, [user]);

  // Poll for unread notifications every 15s (matches group page activity refresh)
  useEffect(() => {
    if (!user) return;
    const fetchUnread = () =>
      fetch('/api/notifications')
        .then(r => r.json())
        .then(d => setUnread(d.unread ?? 0))
        .catch(() => {});
    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);
    return () => clearInterval(interval);
  }, [user]);

  // Listen for read events broadcast from the notifications page
  useEffect(() => {
    if (!user) return;
    const channel = new BroadcastChannel('notifications');
    channel.onmessage = (event) => {
      if (event.data?.type === 'read') {
        fetch('/api/notifications')
          .then(r => r.json())
          .then(d => setUnread(d.unread ?? 0))
          .catch(() => {});
      }
    };
    return () => channel.close();
  }, [user]);

  return (
    <>
      {/*
        Performance note: backdropFilter blur is GPU-composited on every scroll
        frame and is extremely expensive on mobile (iOS/Android). We gate it
        behind a CSS class that only applies on pointer-capable (desktop) devices
        via @media (hover: hover). Mobile gets a fully opaque header instead,
        which is visually identical on a dark background and costs nothing.
      */}
      <style>{`
        .header-blur {
          background: #0f0f0f;
        }
        @media (hover: hover) {
          .header-blur {
            background: rgba(15,15,15,0.85);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
          }
        }
      `}</style>
      <header
        className="header-blur"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          width: '100%',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div style={{
          maxWidth: '960px',
          margin: '0 auto',
          padding: '0 1rem',
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1.1rem', color: 'var(--color-text)', textDecoration: 'none' }}>
            <img src="/android-chrome-192x192.png" alt="dropzone logo" width={28} height={28} style={{ borderRadius: '6px' }} />
            dropzone
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {isSiteAdmin && (
              <Link href="/admin" style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                🛡️ Admin
              </Link>
            )}

            {user && (
              <Link
                href="/notifications"
                aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
                style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '50%', color: unread > 0 ? 'var(--color-text)' : 'var(--color-text-muted)', transition: 'color 0.15s, background 0.15s', textDecoration: 'none' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                {unread > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: 0,
                    right: -4,
                    minWidth: 16,
                    height: 16,
                    borderRadius: '9999px',
                    background: 'var(--color-primary)',
                    color: '#fff',
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 3px',
                    lineHeight: 1,
                    border: '2px solid rgba(15,15,15,0.85)',
                    pointerEvents: 'none',
                  }}>
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </Link>
            )}

            {user ? (
              <Link
                href="/profile"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text)', fontSize: '0.875rem', fontWeight: 500, textDecoration: 'none' }}
              >
                {user.image ? (
                  <img src={user.image} alt={user.name ?? 'Profile'} width={32} height={32} style={{ borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--color-accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 600, color: '#fff', flexShrink: 0 }}>
                    {(user.name ?? 'U')[0].toUpperCase()}
                  </span>
                )}
                <span style={{ color: 'var(--color-text-muted)' }}>{user.name ?? 'Profile'}</span>
              </Link>
            ) : (
              <Link href="/login" style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-muted)' }}>Sign in</Link>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
