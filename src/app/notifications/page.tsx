'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Notification {
  id: string;
  type: string;
  message: string;
  link?: string | null;
  actorName?: string | null;
  actorAvatar?: string | null;
  read: boolean;
  createdAt: string;
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function typeIcon(type: string) {
  if (type === 'reaction') return '💬';
  if (type === 'new_post') return '📎';
  if (type === 'new_member') return '👋';
  return '🔔';
}

export default function NotificationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (status === 'unauthenticated') router.push('/login'); }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/notifications')
      .then(r => r.json())
      .then(d => { setNotifications(d.notifications ?? []); setLoading(false); });
  }, [status]);

  async function markAllRead() {
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    const channel = new BroadcastChannel('notifications');
    channel.postMessage({ type: 'read' });
    channel.close();
  }

  async function markOneRead(id: string) {
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [id] }) });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    const channel = new BroadcastChannel('notifications');
    channel.postMessage({ type: 'read' });
    channel.close();
  }

  const unread = notifications.filter(n => !n.read).length;

  if (status === 'loading' || loading) return <div style={{ padding: '2rem', color: 'var(--color-text-muted)' }}>Loading...</div>;

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Notifications</h1>
          {unread > 0 && <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>{unread} unread</p>}
        </div>
        {unread > 0 && (
          <button className="btn btn-ghost" style={{ fontSize: '0.82rem' }} onClick={markAllRead}>
            Mark all read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
          <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔔</p>
          <p>Nothing here yet — activity from your groups will show up here.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {notifications.map(n => {
            const handleClick = async () => {
              if (!n.read) await markOneRead(n.id);
              if (n.link) router.push(n.link);
            };

            const inner = (
              <div
                key={n.id}
                onClick={n.link ? handleClick : (!n.read ? () => markOneRead(n.id) : undefined)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: '0.85rem',
                  padding: '0.9rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  background: n.read ? 'var(--color-surface)' : 'var(--color-surface-offset)',
                  cursor: n.link ? 'pointer' : 'default',
                  transition: 'background 0.15s',
                  position: 'relative',
                }}
              >
                {/* Unread dot */}
                {!n.read && (
                  <span style={{
                    position: 'absolute', top: '0.85rem', right: '0.85rem',
                    width: 8, height: 8, borderRadius: '50%',
                    background: 'var(--color-primary)',
                  }} />
                )}

                {/* Actor avatar or type icon */}
                {n.actorAvatar ? (
                  <img src={n.actorAvatar} alt={n.actorName ?? ''} width={36} height={36} style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--color-surface-dynamic)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                    {typeIcon(n.type)}
                  </div>
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '0.875rem', lineHeight: 1.45, color: n.read ? 'var(--color-text-muted)' : 'var(--color-text)', margin: 0 }}>
                    {n.message}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-faint)', marginTop: '0.25rem' }}>
                    {timeAgo(n.createdAt)}
                  </p>
                </div>
              </div>
            );

            return (
              <div key={n.id}>{inner}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
