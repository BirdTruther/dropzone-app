'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Group { id: string; name: string; description?: string; emoji: string; inviteCode: string; role: string; _count: { members: number; posts: number }; }

export default function GroupsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [modalTab, setModalTab] = useState<'choose' | 'create' | 'join'>('choose');
  const [form, setForm] = useState({ name: '', description: '', emoji: '🔗' });
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (status === 'unauthenticated') router.push('/login'); }, [status, router]);
  useEffect(() => { if (status === 'authenticated') fetch('/api/groups').then(r => r.json()).then(setGroups); }, [status]);

  function openModal() { setModalTab('choose'); setShowGroupModal(true); }
  function closeModal() { setShowGroupModal(false); setForm({ name: '', description: '', emoji: '🔗' }); setInviteCode(''); }

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const g = await res.json();
    setGroups(prev => [{ ...g, role: 'owner', _count: { members: 1, posts: 0 } }, ...prev]);
    closeModal();
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

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Your Groups</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Hey, {session?.user?.name} 👋</p>
        </div>
        <button className="btn btn-primary" onClick={openModal} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
          Group
        </button>
      </div>

      {/* Groups list */}
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

      {/* Group modal */}
      {showGroupModal && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', padding: '1rem' }}
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="card" style={{ width: '100%', maxWidth: 420, padding: '1.75rem', position: 'relative' }}>

            {/* Close */}
            <button onClick={closeModal} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '1.1rem', lineHeight: 1 }}>✕</button>

            {/* Choose */}
            {modalTab === 'choose' && (
              <>
                <h2 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.35rem' }}>👥 Groups</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>What would you like to do?</p>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    onClick={() => setModalTab('create')}
                    style={{
                      flex: 1, padding: '1.1rem 0.75rem', borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)', background: 'var(--color-surface-2)',
                      cursor: 'pointer', textAlign: 'center', transition: 'border-color 0.15s, background 0.15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-accent, #5b6af7)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface-offset)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface-2)'; }}
                  >
                    <div style={{ fontSize: '1.75rem', marginBottom: '0.4rem' }}>✨</div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Create a Group</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>Start something new</div>
                  </button>
                  <button
                    onClick={() => setModalTab('join')}
                    style={{
                      flex: 1, padding: '1.1rem 0.75rem', borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)', background: 'var(--color-surface-2)',
                      cursor: 'pointer', textAlign: 'center', transition: 'border-color 0.15s, background 0.15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-accent, #5b6af7)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface-offset)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface-2)'; }}
                  >
                    <div style={{ fontSize: '1.75rem', marginBottom: '0.4rem' }}>🔗</div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Join a Group</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>Use an invite code</div>
                  </button>
                </div>
              </>
            )}

            {/* Create */}
            {modalTab === 'create' && (
              <>
                <button onClick={() => setModalTab('choose')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '0.82rem', marginBottom: '1rem', padding: 0, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  ← Back
                </button>
                <h2 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '1.25rem' }}>✨ Create a Group</h2>
                <form onSubmit={createGroup} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input value={form.emoji} onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))} style={{ width: 60 }} maxLength={2} />
                    <input placeholder="Group name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required style={{ flex: 1 }} />
                  </div>
                  <input placeholder="Description (optional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                    <button type="button" className="btn btn-ghost" onClick={closeModal}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Creating...' : 'Create'}</button>
                  </div>
                </form>
              </>
            )}

            {/* Join */}
            {modalTab === 'join' && (
              <>
                <button onClick={() => setModalTab('choose')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '0.82rem', marginBottom: '1rem', padding: 0, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  ← Back
                </button>
                <h2 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.35rem' }}>🔗 Join a Group</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem' }}>Paste the invite code someone shared with you.</p>
                <form onSubmit={joinGroup} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <input placeholder="Invite code" value={inviteCode} onChange={e => setInviteCode(e.target.value)} required autoFocus />
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-ghost" onClick={closeModal}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Joining...' : 'Join'}</button>
                  </div>
                </form>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
