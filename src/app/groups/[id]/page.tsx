'use client';
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import PostEmbed from '@/components/PostEmbed';
import { getEmbed } from '@/lib/embed';

interface Author { id: string; name: string; avatar?: string; }
interface Reaction { id: string; emoji: string; userId: string; }
interface Post { id: string; url: string; title?: string; description?: string; image?: string; siteName?: string; note?: string; createdAt: string; author: Author; reactions: Reaction[]; }
interface GroupData { id: string; name: string; emoji: string; inviteCode: string; description?: string; role?: string; }

const REACTION_OPTIONS = ['❤️', '😂', '🔥', '👀', '😮', '👍'];

const EMOJI_OPTIONS = ['🔗','🎮','🎵','🎬','📚','💡','🏆','🌍','🍕','😂','🔥','💬','📸','🎨','⚽','🐦','🚀','🛠️','💎','🌙'];

export default function GroupPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const groupId = params.id as string;
  const userId = (session?.user as any)?.id;

  const [group, setGroup] = useState<GroupData | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [posting, setPosting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Edit modal state
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmoji, setEditEmoji] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editMsg, setEditMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadPosts = useCallback(async () => {
    const res = await fetch(`/api/groups/${groupId}/posts`);
    if (res.ok) setPosts(await res.json());
  }, [groupId]);

  useEffect(() => { if (status === 'unauthenticated') router.push('/login'); }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/groups').then(r => r.json()).then((gs: GroupData[]) => {
      const g = gs.find((x: GroupData) => x.id === groupId);
      if (g) { setGroup(g); } else router.push('/groups');
    });
    loadPosts();
  }, [status, groupId, loadPosts, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    const interval = setInterval(loadPosts, 15000);
    return () => clearInterval(interval);
  }, [status, loadPosts]);

  function openEdit() {
    if (!group) return;
    setEditName(group.name);
    setEditEmoji(group.emoji);
    setEditDesc(group.description ?? '');
    setEditMsg(null);
    setShowEdit(true);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setEditLoading(true);
    setEditMsg(null);
    const res = await fetch(`/api/groups/${groupId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName, emoji: editEmoji, description: editDesc }),
    });
    const data = await res.json();
    setEditLoading(false);
    if (!res.ok) return setEditMsg({ type: 'err', text: data.error ?? 'Something went wrong' });
    setGroup(prev => prev ? { ...prev, name: data.name, emoji: data.emoji, description: data.description } : prev);
    setEditMsg({ type: 'ok', text: 'Group updated!' });
    setTimeout(() => setShowEdit(false), 800);
  }

  async function submitPost(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setPosting(true);
    const res = await fetch(`/api/groups/${groupId}/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url.trim(), note: note.trim() || undefined }),
    });
    if (res.ok) { const post = await res.json(); setPosts(prev => [post, ...prev]); setUrl(''); setNote(''); }
    setPosting(false);
  }

  async function toggleReaction(postId: string, emoji: string) {
    const res = await fetch(`/api/posts/${postId}/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji }),
    });
    if (res.ok) loadPosts();
  }

  function copyInvite() {
    if (group) { navigator.clipboard.writeText(group.inviteCode); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  }

  function timeAgo(date: string) {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  if (status === 'loading' || !group) return <div style={{ padding: '2rem', color: 'var(--color-text-muted)' }}>Loading...</div>;

  const isAdmin = group.role === 'admin';

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '1rem' }}>

      {/* Edit Modal */}
      {showEdit && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowEdit(false); }}>
          <div className="card" style={{ width: '100%', maxWidth: 440, padding: '1.5rem', margin: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>Edit Group</h3>
              <button onClick={() => setShowEdit(false)} style={{ color: 'var(--color-text-muted)', fontSize: '1.2rem' }}>✕</button>
            </div>
            <form onSubmit={saveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.4rem' }}>Group Name</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Group name" required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.4rem' }}>Icon</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
                  {EMOJI_OPTIONS.map(em => (
                    <button key={em} type="button"
                      onClick={() => setEditEmoji(em)}
                      style={{
                        width: 38, height: 38, fontSize: '1.2rem', borderRadius: 'var(--radius-sm)',
                        border: `2px solid ${editEmoji === em ? 'var(--color-accent)' : 'var(--color-border)'}`,
                        background: editEmoji === em ? 'rgba(91,106,247,0.15)' : 'var(--color-surface-2)',
                        cursor: 'pointer', transition: 'all 0.12s',
                      }}>{em}</button>
                  ))}
                </div>
                <input value={editEmoji} onChange={e => setEditEmoji(e.target.value)} placeholder="Or type any emoji" style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.4rem' }}>Description <span style={{ opacity: 0.5 }}>(optional)</span></label>
                <input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="What's this group about?" />
              </div>
              {editMsg && (
                <div style={{ padding: '0.6rem 0.9rem', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem',
                  background: editMsg.type === 'ok' ? 'rgba(91,106,247,0.12)' : 'rgba(224,92,92,0.12)',
                  color: editMsg.type === 'ok' ? 'var(--color-accent)' : 'var(--color-danger)' }}>
                  {editMsg.text}
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="submit" className="btn btn-primary" disabled={editLoading}>{editLoading ? 'Saving...' : 'Save Changes'}</button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowEdit(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid var(--color-border)' }}>
        <Link href="/groups" style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>← Back</Link>
        <span style={{ fontSize: '1.5rem' }}>{group.emoji}</span>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontWeight: 700, fontSize: '1.1rem' }}>{group.name}</h2>
          {group.description && <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{group.description}</p>}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {isAdmin && (
            <button className="btn btn-ghost" onClick={openEdit} style={{ fontSize: '0.8rem' }}>⚙️ Edit</button>
          )}
          <button className="btn btn-ghost" onClick={copyInvite} style={{ fontSize: '0.8rem' }}>
            {copied ? '✅ Copied!' : '🔗 Invite'}
          </button>
        </div>
      </div>

      {/* Composer */}
      <form onSubmit={submitPost} className="card" style={{ marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        <input type="url" placeholder="Paste a link..." value={url} onChange={e => setUrl(e.target.value)} required style={{ fontSize: '0.95rem' }} />
        <input placeholder="Add a note (optional)" value={note} onChange={e => setNote(e.target.value)} />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="btn btn-primary" disabled={posting || !url.trim()}>{posting ? 'Sharing...' : 'Drop It 🔗'}</button>
        </div>
      </form>

      {/* Feed */}
      {posts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
          <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</p>
          <p>Nothing dropped yet. Be the first!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          {posts.map(post => {
            const myReactions = new Set(post.reactions.filter(r => r.userId === userId).map(r => r.emoji));
            const reactionCounts: Record<string, number> = {};
            post.reactions.forEach(r => { reactionCounts[r.emoji] = (reactionCounts[r.emoji] ?? 0) + 1; });
            const embed = getEmbed(post.url);
            const hasEmbed = embed.type !== 'none';
            return (
              <div key={post.id} className="card" style={{ padding: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  <span><strong style={{ color: 'var(--color-text)' }}>{post.author.name}</strong></span>
                  <span>{timeAgo(post.createdAt)}</span>
                </div>
                {post.note && <p style={{ marginBottom: '0.6rem', fontSize: '0.9rem' }}>{post.note}</p>}
                {hasEmbed ? (
                  <PostEmbed url={post.url} />
                ) : (
                  <a href={post.url} target="_blank" rel="noopener noreferrer">
                    <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden', background: 'var(--color-surface-2)' }}>
                      {post.image && (
                        <div style={{ position: 'relative', width: '100%', height: 180 }}>
                          <Image src={post.image} alt={post.title ?? ''} fill style={{ objectFit: 'cover' }} unoptimized />
                        </div>
                      )}
                      <div style={{ padding: '0.7rem 0.9rem' }}>
                        {post.siteName && <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{post.siteName}</p>}
                        {post.title && <p style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.25rem' }}>{post.title}</p>}
                        {post.description && <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{post.description}</p>}
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-accent)', marginTop: '0.35rem' }}>{post.url.slice(0, 60)}{post.url.length > 60 ? '...' : ''}</p>
                      </div>
                    </div>
                  </a>
                )}
                {hasEmbed && (
                  <a href={post.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.4rem' }}>
                    ↗ Open in {embed.type.charAt(0).toUpperCase() + embed.type.slice(1)}
                  </a>
                )}
                <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.65rem', flexWrap: 'wrap' }}>
                  {REACTION_OPTIONS.map(emoji => (
                    <button key={emoji} onClick={() => toggleReaction(post.id, emoji)}
                      style={{
                        padding: '0.25rem 0.55rem', borderRadius: 20, fontSize: '0.85rem',
                        border: `1px solid ${myReactions.has(emoji) ? 'var(--color-accent)' : 'var(--color-border)'}`,
                        background: myReactions.has(emoji) ? 'rgba(91,106,247,0.15)' : 'transparent',
                        color: 'var(--color-text)', transition: 'all 0.12s', cursor: 'pointer',
                      }}>
                      {emoji}{reactionCounts[emoji] ? ` ${reactionCounts[emoji]}` : ''}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
