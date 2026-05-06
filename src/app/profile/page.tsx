'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const user = session?.user as { name?: string | null; email?: string | null; image?: string | null } | undefined;

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '480px', margin: '3rem auto', padding: '0 1rem' }}>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '2rem' }}>
        {user?.image ? (
          <img
            src={user.image}
            alt={user.name ?? 'Profile'}
            width={80}
            height={80}
            style={{ borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : (
          <span style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: 'var(--color-accent)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
            fontWeight: 700,
            color: '#fff',
          }}>
            {(user?.name ?? 'U')[0].toUpperCase()}
          </span>
        )}

        <div style={{ textAlign: 'center' }}>
          <p style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--color-text)' }}>{user?.name ?? 'Unknown'}</p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>{user?.email ?? ''}</p>
        </div>

        <button
          className="btn btn-ghost"
          style={{ marginTop: '0.5rem', width: '100%', justifyContent: 'center' }}
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
