'use client';
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

interface Author { id: string; name: string; avatar?: string; }
interface Reaction { id: string; emoji: string; userId: string; }
interface Post { id: string; url: string; title?: string; description?: string; image?: string; siteName?: string; note?: string; createdAt: string; author: Author; reactions: Reaction[]; }
interface GroupData { id: string; name: string; emoji: string; inviteCode: string; description?: string; }

const REACTION_OPTIONS = ['❤️', '😂', '🔥', '👀', '😮', '👍'];

export default function GroupPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const groupId = params.id as string;

  const [group, setGroup] = useState<GroupData | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [posting, setPosting] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadPosts = useCallback(async () => {
    const res = await fetch(`/api/groups/${groupId}/posts`);
    if (res.ok) setPosts(await res.json());
  }, [groupId]);

  useEffect(() => { if (status === 'unauthenticated') router.push('/login'); }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/groups').then(r => r.json()).then((gs: GroupData[]) => {
      const g = gs.find((x: GroupData) => x.id === groupId);
      if (g) setGroup(g); else router.push('/groups');
    });
    loadPosts();
  }, [status, groupId, loadPosts, router]);

  // Poll every 15 seconds for new posts
  useEffect(() => {
    if (status !== 'authenticated') return;
    const interval = setInterval(loadPosts, 15000);
    return () => clearInterval(interval);
  }, [status, loadPosts]);

  async function submitPost(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setPosting(true);
    const res = await fetch(`/api/groups/${groupId}/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url.trim(), note: note.trim() || undefined }),
    });
    if (res.ok) {
      const post = await res.json();
      setPosts(prev => [post, ...prev]);
      setUrl('');
      setNote('');
    }
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
    if (group) {
      navigator.clipboard.writeText(group.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function timeAgo(date: string) {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  if (status === 'loading' || !group) return <div style={{ padding: '2rem', color: 'var(--color-text-muted)' }}>Loading...</div>;

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid var(--color-border)' }}>
        <Link href="/groups" style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>← Back</Link>
        <span style={{ fontSize: '1.5rem' }}>{group.emoji}</span>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontWeight: 700, fontSize: '1.1rem' }}>{group.name}</h2>
          {group.description && <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{group.description}</p>}
        </div>
        <button className="btn btn-ghost" onClick={copyInvite} style={{ fontSize: '0.8rem' }}>
          {copied ? '✅ Copied!' : '🔗 Invite'}
        </button>
      </div>

      {/* Composer */}
      <form onSubmit={submitPost} className="card" style={{ marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        <input
          type="url"
          placeholder="Paste a link..."
          value={url}
          onChange={e => setUrl(e.target.value)}
          required
          style={{ fontSize: '0.95rem' }}
        />
        <input
          placeholder="Add a note (optional)"
          value={note}
          onChange={e => setNote(e.target.value)}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="btn btn-primary" disabled={posting || !url.trim()}>
            {posting ? 'Sharing...' : 'Drop It 🔗'}
          </button>
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
            const myReactions = new Set(post.reactions.filter(r => r.userId === session?.user?.id).map(r => r.emoji));
            const reactionCounts: Record<string, number> = {};
            post.reactions.forEach(r => { reactionCounts[r.emoji] = (reactionCounts[r.emoji] ?? 0) + 1; });
            return (
              <div key={post.id} className="card" style={{ padding: '0.9rem' }}>
                {/* Post meta */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  <span><strong style={{ color: 'var(--color-text)' }}>{post.author.name}</strong></span>
                  <span>{timeAgo(post.createdAt)}</span>
                </div>
                {/* Note */}
                {post.note && <p style={{ marginBottom: '0.6rem', fontSize: '0.9rem' }}>{post.note}</p>}
                {/* Preview card */}
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
                {/* Reactions */}
                <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.65rem', flexWrap: 'wrap' }}>
                  {REACTION_OPTIONS.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => toggleReaction(post.id, emoji)}
                      style={{
                        padding: '0.25rem 0.55rem',
                        borderRadius: 20,
                        fontSize: '0.85rem',
                        border: `1px solid ${myReactions.has(emoji) ? 'var(--color-accent)' : 'var(--color-border)'}`,
                        background: myReactions.has(emoji) ? 'rgba(91,106,247,0.15)' : 'transparent',
                        color: 'var(--color-text)',
                        transition: 'all 0.12s',
                        cursor: 'pointer',
                      }}
                    >
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
