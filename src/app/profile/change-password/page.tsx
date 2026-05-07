'use client';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ChangePasswordPage() {
  const { status } = useSession();
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  if (status === 'unauthenticated') { router.push('/login'); return null; }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (next.length < 6) { setError('New password must be at least 6 characters.'); return; }
    if (next !== confirm) { setError('New passwords do not match.'); return; }
    setLoading(true);
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    setLoading(false);
    if (res.ok) { setSuccess(true); }
    else { const d = await res.json(); setError(d.error ?? 'Something went wrong.'); }
  }

  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div className="card" style={{ width: '100%', maxWidth: 400, padding: '2rem' }}>
        <h1 style={{ fontWeight: 700, fontSize: '1.2rem', marginBottom: '0.25rem' }}>🔑 Change Password</h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>Update your dropzone password.</p>

        {success ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <p style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>✅</p>
            <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Password updated!</p>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem' }}>You can now log in with your new password.</p>
            <Link href="/groups" style={{ padding: '0.5rem 1.25rem', borderRadius: 'var(--radius-sm)', background: 'var(--color-accent, #5b6af7)', color: '#fff', fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}>Back to feed</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem', color: 'var(--color-text-muted)' }}>Current Password</label>
              <input type="password" value={current} onChange={e => setCurrent(e.target.value)} required
                style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', color: 'var(--color-text)', fontSize: '0.9rem' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem', color: 'var(--color-text-muted)' }}>New Password</label>
              <input type="password" value={next} onChange={e => setNext(e.target.value)} required placeholder="Min. 6 characters"
                style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', color: 'var(--color-text)', fontSize: '0.9rem' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem', color: 'var(--color-text-muted)' }}>Confirm New Password</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
                style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', color: 'var(--color-text)', fontSize: '0.9rem' }} />
            </div>
            {error && <p style={{ fontSize: '0.82rem', color: 'var(--color-danger, #e05c5c)' }}>{error}</p>}
            <button type="submit" disabled={loading}
              style={{ padding: '0.6rem', borderRadius: 'var(--radius-sm)', background: 'var(--color-accent, #5b6af7)', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Saving...' : 'Update Password'}
            </button>
            <Link href="/profile" style={{ textAlign: 'center', fontSize: '0.82rem', color: 'var(--color-text-muted)', textDecoration: 'none' }}>← Back to profile</Link>
          </form>
        )}
      </div>
    </div>
  );
}
