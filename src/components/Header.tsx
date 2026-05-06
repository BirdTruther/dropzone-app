'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';

export default function Header() {
  const { data: session } = useSession();
  const user = session?.user as { name?: string | null; email?: string | null; image?: string | null } | undefined;

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      width: '100%',
      borderBottom: '1px solid rgba(0,0,0,0.08)',
      background: 'rgba(255,255,255,0.9)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
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
        {/* Logo / App name */}
        <Link href="/" style={{ fontWeight: 700, fontSize: '1.1rem', textDecoration: 'none', color: 'inherit' }}>
          Dropzone
        </Link>

        {/* Right side — profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {user ? (
            <Link
              href="/profile"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                textDecoration: 'none',
                color: 'inherit',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              {user.image ? (
                <img
                  src={user.image}
                  alt={user.name ?? 'Profile'}
                  width={32}
                  height={32}
                  style={{ borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                <span style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: '#e5e7eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: '#374151',
                }}>
                  {(user.name ?? 'U')[0].toUpperCase()}
                </span>
              )}
              <span>{user.name ?? 'Profile'}</span>
            </Link>
          ) : (
            <Link
              href="/login"
              style={{
                fontSize: '0.875rem',
                fontWeight: 500,
                textDecoration: 'none',
                color: '#374151',
              }}
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
