'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface StorageData {
  totalFiles: number;
  totalBytes: number;
  files: { name: string; sizeBytes: number; createdAt: string }[];
}

interface StatsData {
  users: number;
  groups: number;
  posts: number;
  comments: number;
  reactions: number;
  pushSubscriptions: number;
}

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [storage, setStorage] = useState<StorageData | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loadingStorage, setLoadingStorage] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);

  const sessionUser = (session?.user as any);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
    if (status === 'authenticated' && sessionUser?.role !== 'admin') router.push('/groups');
  }, [status, sessionUser, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/storage')
      .then(r => r.ok ? r.json() : null)
      .then(d => { setStorage(d); setLoadingStorage(false); });
    fetch('/api/admin/stats')
      .then(r => r.ok ? r.json() : null)
      .then(d => { setStats(d); setLoadingStats(false); });
  }, [status]);

  async function deleteFile(filename: string) {
    if (!confirm(`Delete ${filename}? This cannot be undone.`)) return;
    setDeletingFile(filename);
    const res = await fetch(`/api/admin/uploads/${encodeURIComponent(filename)}`, { method: 'DELETE' });
    if (res.ok) {
      setStorage(prev => prev ? {
        ...prev,
        totalFiles: prev.totalFiles - 1,
        totalBytes: prev.totalBytes - (prev.files.find(f => f.name === filename)?.sizeBytes ?? 0),
        files: prev.files.filter(f => f.name !== filename),
      } : prev);
      setDeleteMsg(`Deleted ${filename}`);
      setTimeout(() => setDeleteMsg(null), 3000);
    }
    setDeletingFile(null);
  }

  if (status === 'loading') return <div style={{ padding: '2rem', color: 'var(--color-text-muted)' }}>Loading...</div>;

  const usedPct = storage ? Math.min(100, (storage.totalBytes / (1024 * 1024 * 1024)) * 100) : 0;

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '1.5rem 1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--color-border)' }}>
        <Link href="/groups" style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>← Back</Link>
        <h1 style={{ fontWeight: 700, fontSize: '1.2rem', flex: 1 }}>⚙️ Admin Dashboard</h1>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Users', value: stats?.users, icon: '👤' },
          { label: 'Groups', value: stats?.groups, icon: '👥' },
          { label: 'Posts', value: stats?.posts, icon: '🔗' },
          { label: 'Comments', value: stats?.comments, icon: '💬' },
          { label: 'Reactions', value: stats?.reactions, icon: '❤️' },
          { label: 'Push Subs', value: stats?.pushSubscriptions, icon: '🔔' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '0.9rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem', marginBottom: '0.25rem' }}>{s.icon}</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, lineHeight: 1 }}>
              {loadingStats ? '…' : (s.value ?? '–')}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Storage section */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
          <h2 style={{ fontWeight: 700, fontSize: '1rem' }}>📁 Upload Storage</h2>
          {storage && (
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              {fmt(storage.totalBytes)} across {storage.totalFiles} file{storage.totalFiles !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Progress bar */}
        {storage && (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ height: 8, borderRadius: 99, background: 'var(--color-surface-offset)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 99, transition: 'width 0.6s ease',
                width: `${usedPct}%`,
                background: usedPct > 80 ? 'var(--color-danger, #e05c5c)' : usedPct > 50 ? '#f97316' : 'var(--color-accent, #5b6af7)',
              }} />
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.3rem' }}>
              {usedPct.toFixed(1)}% of 1 GB shown (actual limit depends on your disk)
            </p>
          </div>
        )}

        {deleteMsg && (
          <div style={{ marginBottom: '0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(91,106,247,0.1)', borderRadius: 6, fontSize: '0.8rem', color: 'var(--color-accent, #5b6af7)' }}>
            ✅ {deleteMsg}
          </div>
        )}

        {loadingStorage ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Loading files…</p>
        ) : !storage || storage.files.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
            <p style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>📭</p>
            <p style={{ fontSize: '0.875rem' }}>No uploaded files yet.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {['File', 'Size', 'Uploaded', ''].map(h => (
                    <th key={h} style={{ textAlign: h === '' ? 'right' : 'left', padding: '0.4rem 0.5rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.68rem', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {storage.files.map(f => (
                  <tr key={f.name} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '0.5rem', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <a href={`/api/uploads/${f.name}`} target="_blank" rel="noopener noreferrer"
                        style={{ color: 'var(--color-accent, #5b6af7)', textDecoration: 'none' }}>
                        {f.name}
                      </a>
                    </td>
                    <td style={{ padding: '0.5rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{fmt(f.sizeBytes)}</td>
                    <td style={{ padding: '0.5rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{timeAgo(f.createdAt)}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                      <button
                        onClick={() => deleteFile(f.name)}
                        disabled={deletingFile === f.name}
                        style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: 4, border: '1px solid rgba(224,92,92,0.3)', background: 'rgba(224,92,92,0.08)', color: 'var(--color-danger, #e05c5c)', cursor: 'pointer' }}
                      >
                        {deletingFile === f.name ? '…' : '🗑️ Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
