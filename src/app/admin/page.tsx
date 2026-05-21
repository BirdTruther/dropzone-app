'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface AdminUser {
  id: string; name: string; email: string; avatar?: string;
  isSiteAdmin: boolean; createdAt: string;
  _count: { posts: number; memberships: number };
}
interface AdminPost {
  id: string; url: string; note?: string; createdAt: string;
  author: { id: string; name: string; email: string };
  group: { id: string; name: string };
}
interface GroupStat {
  id: string; name: string; emoji: string;
  _count: { posts: number; members: number };
}
interface StatsData {
  users: number; groups: number; posts: number;
  comments: number; reactions: number; pushSubscriptions: number;
  groupStats: GroupStat[];
}
interface StorageData {
  used: number; total: number; percent: number;
  usedFormatted: string; totalFormatted: string;
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
  const [tab, setTab] = useState<'users' | 'posts' | 'stats'>('users');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [storage, setStorage] = useState<StorageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'user' | 'post'; id: string; label: string } | null>(null);
  const [resetModal, setResetModal] = useState<{ userId: string; name: string } | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => { if (status === 'unauthenticated') router.push('/login'); }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/admin/users')
      .then(r => { if (r.status === 403) { setAuthorized(false); return null; } setAuthorized(true); return r.json(); })
      .then(data => { if (data) setUsers(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [status]);

  useEffect(() => {
    if (tab !== 'posts' || posts.length > 0) return;
    fetch('/api/admin/posts').then(r => r.json()).then(setPosts);
  }, [tab]);

  useEffect(() => {
    if (tab !== 'stats' || stats) return;
    setLoadingStats(true);
    Promise.all([
      fetch('/api/admin/stats').then(r => r.ok ? r.json() : null),
      fetch('/api/storage').then(r => r.ok ? r.json() : null),
    ]).then(([s, st]) => {
      if (s) setStats(s);
      if (st) setStorage(st);
      setLoadingStats(false);
    });
  }, [tab, stats]);

  async function deleteUser(userId: string) {
    await fetch('/api/admin/users', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) });
    setUsers(prev => prev.filter(u => u.id !== userId));
    setConfirmDelete(null);
  }

  async function deletePost(postId: string) {
    await fetch('/api/admin/posts', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId }) });
    setPosts(prev => prev.filter(p => p.id !== postId));
    setConfirmDelete(null);
  }

  async function toggleAdmin(userId: string, current: boolean) {
    await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, isSiteAdmin: !current }) });
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, isSiteAdmin: !current } : u));
  }

  function openResetModal(userId: string, name: string) {
    setResetModal({ userId, name });
    setResetPassword('');
    setResetConfirm('');
    setResetError('');
    setResetSuccess(false);
  }

  async function handleResetPassword() {
    setResetError('');
    if (resetPassword.length < 6) { setResetError('Password must be at least 6 characters.'); return; }
    if (resetPassword !== resetConfirm) { setResetError('Passwords do not match.'); return; }
    setResetLoading(true);
    const res = await fetch('/api/admin/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: resetModal!.userId, newPassword: resetPassword }),
    });
    setResetLoading(false);
    if (res.ok) { setResetSuccess(true); }
    else { const d = await res.json(); setResetError(d.error ?? 'Something went wrong.'); }
  }

  if (status === 'loading' || loading) return <div style={{ padding: '2rem', color: 'var(--color-text-muted)' }}>Loading...</div>;
  if (authorized === false) return (
    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
      <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🚫</p>
      <p>You don&apos;t have access to this page.</p>
    </div>
  );

  const TAB_STYLE = (active: boolean): React.CSSProperties => ({
    padding: '0.45rem 1rem', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', fontWeight: active ? 600 : 400,
    background: active ? 'var(--color-accent, #5b6af7)' : 'transparent',
    color: active ? '#fff' : 'var(--color-text-muted)',
    border: 'none', cursor: 'pointer', transition: 'all 0.12s',
  });

  const totalPosts = stats?.posts ?? 0;

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '1.5rem 1rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontWeight: 700, fontSize: '1.3rem', marginBottom: '0.25rem' }}>🛡️ Server Admin</h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Manage users and content across Dropzone.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.25rem', padding: '0.3rem', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', width: 'fit-content' }}>
        <button style={TAB_STYLE(tab === 'users')} onClick={() => setTab('users')}>Users ({users.length})</button>
        <button style={TAB_STYLE(tab === 'posts')} onClick={() => setTab('posts')}>Posts</button>
        <button style={TAB_STYLE(tab === 'stats')} onClick={() => setTab('stats')}>📊 Stats</button>
      </div>

      {/* Users tab */}
      {tab === 'users' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {users.map(u => (
            <div key={u.id} className="card" style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {u.avatar
                ? <img src={u.avatar} alt={u.name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                : <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--color-accent, #5b6af7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>{u.name[0].toUpperCase()}</div>
              }
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{u.name}</span>
                  {u.isSiteAdmin && <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: 'var(--radius-full)', background: 'var(--color-accent, #5b6af7)', color: '#fff' }}>ADMIN</span>}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{u.email} &bull; {u._count.posts} posts &bull; {u._count.memberships} groups</div>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button onClick={() => toggleAdmin(u.id, u.isSiteAdmin)}
                  style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                  {u.isSiteAdmin ? 'Remove Admin' : 'Make Admin'}
                </button>
                <button onClick={() => openResetModal(u.id, u.name)}
                  style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.08)', color: '#f59e0b', cursor: 'pointer' }}>
                  Reset Password
                </button>
                <button onClick={() => setConfirmDelete({ type: 'user', id: u.id, label: u.name })}
                  style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(224,92,92,0.3)', background: 'rgba(224,92,92,0.08)', color: 'var(--color-danger, #e05c5c)', cursor: 'pointer' }}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Posts tab */}
      {tab === 'posts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {posts.length === 0 && <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>No posts yet.</p>}
          {posts.map(p => (
            <div key={p.id} className="card" style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.url || p.note || '(upload)'}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  by <strong>{p.author.name}</strong> in <strong>{p.group.name}</strong> &bull; {new Date(p.createdAt).toLocaleDateString()}
                </div>
              </div>
              <button onClick={() => setConfirmDelete({ type: 'post', id: p.id, label: p.url || 'this post' })}
                style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(224,92,92,0.3)', background: 'rgba(224,92,92,0.08)', color: 'var(--color-danger, #e05c5c)', cursor: 'pointer', flexShrink: 0 }}>
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Stats tab */}
      {tab === 'stats' && (
        <div>
          {loadingStats ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Loading stats…</p>
          ) : (
            <>
              {/* Stat tiles */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
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
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, lineHeight: 1 }}>{s.value ?? '–'}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Posts by group */}
              <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
                <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1rem' }}>📊 Posts by Group</h2>
                {!stats?.groupStats?.length ? (
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>No groups yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {stats.groupStats.map(g => {
                      const pct = totalPosts > 0 ? (g._count.posts / totalPosts) * 100 : 0;
                      return (
                        <div key={g.id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.25rem' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{g.emoji} {g.name}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                              {g._count.posts} post{g._count.posts !== 1 ? 's' : ''} · {g._count.members} member{g._count.members !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div style={{ height: 6, borderRadius: 99, background: 'var(--color-surface-offset)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 99, width: `${pct}%`, background: 'var(--color-accent, #5b6af7)', transition: 'width 0.6s ease', minWidth: g._count.posts > 0 ? 4 : 0 }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Storage */}
              {storage && (
                <div className="card" style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
                    <h2 style={{ fontWeight: 700, fontSize: '1rem' }}>📁 Upload Storage</h2>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{storage.usedFormatted} / {storage.totalFormatted}</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 99, background: 'var(--color-surface-offset)', overflow: 'hidden', marginBottom: '0.4rem' }}>
                    <div style={{
                      height: '100%', borderRadius: 99, transition: 'width 0.6s ease',
                      width: `${storage.percent}%`,
                      background: storage.percent > 80 ? 'var(--color-danger, #e05c5c)' : storage.percent > 50 ? '#f97316' : 'var(--color-accent, #5b6af7)',
                    }} />
                  </div>
                  <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{storage.percent}% used</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Reset Password Modal */}
      {resetModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', padding: '1rem' }}
          onClick={e => { if (e.target === e.currentTarget) setResetModal(null); }}>
          <div className="card" style={{ maxWidth: 400, width: '100%', padding: '1.5rem' }}>
            <h3 style={{ fontWeight: 700, marginBottom: '0.25rem' }}>🔑 Reset Password</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem' }}>
              Set a new password for <strong>{resetModal.name}</strong>.
            </p>
            {resetSuccess ? (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <p style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>✅</p>
                <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Password reset!</p>
                <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>Let {resetModal.name} know their new password.</p>
                <button onClick={() => setResetModal(null)} style={{ padding: '0.5rem 1.25rem', borderRadius: 'var(--radius-sm)', background: 'var(--color-accent, #5b6af7)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Done</button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem', color: 'var(--color-text-muted)' }}>New Password</label>
                    <input type="password" value={resetPassword} onChange={e => setResetPassword(e.target.value)} placeholder="Min. 6 characters"
                      style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', color: 'var(--color-text)', fontSize: '0.875rem' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem', color: 'var(--color-text-muted)' }}>Confirm Password</label>
                    <input type="password" value={resetConfirm} onChange={e => setResetConfirm(e.target.value)} placeholder="Repeat new password"
                      onKeyDown={e => { if (e.key === 'Enter') handleResetPassword(); }}
                      style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', color: 'var(--color-text)', fontSize: '0.875rem' }} />
                  </div>
                </div>
                {resetError && <p style={{ fontSize: '0.8rem', color: 'var(--color-danger, #e05c5c)', marginBottom: '0.75rem' }}>{resetError}</p>}
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button onClick={handleResetPassword} disabled={resetLoading}
                    style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)', background: '#f59e0b', color: '#000', border: 'none', cursor: 'pointer', fontWeight: 600, opacity: resetLoading ? 0.6 : 1 }}>
                    {resetLoading ? 'Saving...' : 'Set Password'}
                  </button>
                  <button onClick={() => setResetModal(null)} style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)', background: 'transparent', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', cursor: 'pointer' }}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', padding: '1rem' }}
          onClick={e => { if (e.target === e.currentTarget) setConfirmDelete(null); }}>
          <div className="card" style={{ maxWidth: 400, width: '100%', padding: '1.5rem' }}>
            <h3 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Confirm Delete</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem' }}>
              {confirmDelete.type === 'user'
                ? <>Delete account for <strong>{confirmDelete.label}</strong>? This removes all their posts and group memberships.</>
                : <>Delete post <strong style={{ wordBreak: 'break-all' }}>{confirmDelete.label.slice(0, 60)}</strong>?</>}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn" onClick={() => confirmDelete.type === 'user' ? deleteUser(confirmDelete.id) : deletePost(confirmDelete.id)}
                style={{ background: 'var(--color-danger, #e05c5c)', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600 }}>
                Delete
              </button>
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
