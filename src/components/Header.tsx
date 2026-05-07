'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

export default function Header() {
  const { data: session } = useSession();
  const user = session?.user as { name?: string | null; email?: string | null; image?: string | null } | undefined;
  const [isSiteAdmin, setIsSiteAdmin] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetch('/api/admin/users')
      .then(r => r.ok ? setIsSiteAdmin(true) : null)
      .catch(() => {});
  }, [user]);

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      width: '100%',
      borderBottom: '1px solid var(--color-border)',
      background: 'rgba(15,15,15,0.85)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
    }}>
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
              aria-label="Notifications"
              style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '50%', color: 'var(--color-text-muted)', transition: 'color 0.15s, background 0.15s', textDecoration: 'none' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
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
  );
}
