'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface InviteInfo {
  id: string;
  name: string;
  emoji: string;
  description?: string;
  memberCount: number;
}

export default function JoinPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const code = (params.code as string) ?? '';

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    fetch(`/api/groups/invite/${encodeURIComponent(code)}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('bad'))))
      .then(setInfo)
      .catch(() => setError('This invite link isn’t valid or has expired.'));
  }, [code]);

  async function join() {
    if (joining) return;
    setJoining(true);
    const res = await fetch('/api/groups/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteCode: code }),
    });
    if (res.ok) {
      const g = await res.json();
      router.push(`/groups/${g.id}`);
      return;
    }
    const d = await res.json().catch(() => ({}));
    setJoining(false);
    setError(d.error ?? 'Could not join this group.');
  }

  // Auto-join as soon as we know the user is logged in and the invite resolved
  useEffect(() => {
    if (status === 'authenticated' && info && !error) join();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, info]);

  const renderBody = () => {
    if (error) {
      return (
        <div style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
          <p style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🫥</p>
          <p style={{ marginBottom: '1.25rem' }}>{error}</p>
          <Link href="/groups" className="btn btn-primary" style={{ textDecoration: 'none' }}>Back to Groups</Link>
        </div>
      );
    }
    if (!info) {
      return <p style={{ color: 'var(--color-text-muted)', textAlign: 'center' }}>Loading invite…</p>;
    }
    if (joining) {
      return <p style={{ color: 'var(--color-text-muted)', textAlign: 'center' }}>Joining {info.name}…</p>;
    }
    return (
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>{info.emoji}</p>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' }}>{info.name}</h1>
        {info.description && <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>{info.description}</p>}
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginBottom: '1.5rem' }}>
          {info.memberCount} {info.memberCount === 1 ? 'member' : 'members'}
        </p>
        {status === 'unauthenticated' ? (
          <button
            className="btn btn-primary"
            onClick={() => router.push(`/login?callbackUrl=${encodeURIComponent(`/join/${code}`)}`)}
            style={{ fontSize: '0.95rem' }}
          >
            Log in to join
          </button>
        ) : (
          <button className="btn btn-primary" onClick={join} style={{ fontSize: '0.95rem' }}>
            Join {info.name}
          </button>
        )}
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="card" style={{ width: '100%', maxWidth: 380, padding: '2rem' }}>
        {renderBody()}
      </div>
    </div>
  );
}
