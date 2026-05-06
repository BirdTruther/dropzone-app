'use client';
import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Group { id: string; name: string; description?: string; emoji: string; inviteCode: string; role: string; _count: { members: number; posts: number }; }

export default function GroupsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', emoji: '🔗' });
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (status === 'unauthenticated') router.push('/login'); }, [status, router]);
  useEffect(() => { if (status === 'authenticated') fetch('/api/groups').then(r => r.json()).then(setGroups); }, [status]);

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const g = await res.json();
    setGroups(prev => [{ ...g, role: 'owner', _count: { members: 1, posts: 0 } }, ...prev]);
    setShowCreate(false);
    setForm({ name: '', description: '', emoji: '🔗' });
    setLoading(false);
  }

  async function joinGroup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/groups/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inviteCode }) });
    if (res.ok) {
      const g = await res.json();
      router.push(`/groups/${g.id}`);
    }
    setLoading(false);
  }

  if (status === 'loading') return <div style={{ padding: '2rem', color: 'var(--color-text-muted)' }}>Loading...</div>;

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700 }}>🔗 Dropzone</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Hey, {session?.user?.name} 👋</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-ghost" onClick={() => setShowJoin(v => !v)}>Join Group</button>
          <button className="btn btn-primary" onClick={() => setShowCreate(v => !v)}>+ New Group</button>
          <button className="btn btn-ghost" onClick={() => signOut({ callbackUrl: '/login' })} style={{ padding: '0.5rem 0.75rem' }}>↩</button>
        </div>
      </div>

      {showCreate && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', fontWeight: 600 }}>Create a Group</h3>
          <form onSubmit={createGroup} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input value={form.emoji} onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))} style={{ width: 60 }} maxLength={2} />
              <input placeholder="Group name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required style={{ flex: 1 }} />
            </div>
            <input placeholder="Description (optional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>Create</button>
            </div>
          </form>
        </div>
      )}

      {showJoin && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', fontWeight: 600 }}>Join a Group</h3>
          <form onSubmit={joinGroup} style={{ display: 'flex', gap: '0.5rem' }}>
            <input placeholder="Paste invite code" value={inviteCode} onChange={e => setInviteCode(e.target.value)} required />
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ whiteSpace: 'nowrap' }}>Join</button>
          </form>
        </div>
      )}

      {groups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
          <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</p>
          <p>No groups yet — create one or join with an invite code.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {groups.map(g => (
            <Link key={g.id} href={`/groups/${g.id}`}>
              <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', transition: 'border-color 0.15s' }}>
                <span style={{ fontSize: '2rem' }}>{g.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{g.name}</div>
                  {g.description && <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{g.description}</div>}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textAlign: 'right' }}>
                  <div>{g._count.members} member{g._count.members !== 1 ? 's' : ''}</div>
                  <div>{g._count.posts} post{g._count.posts !== 1 ? 's' : ''}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
