'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import PostEmbed from '@/components/PostEmbed';
import { getEmbed } from '@/lib/embed';

interface Author { id: string; name: string; avatar?: string; }
interface Reaction { id: string; emoji: string; userId: string; }
interface Post { id: string; url: string; title?: string; description?: string; image?: string; siteName?: string; note?: string; uploadUrl?: string; uploadType?: string; expiresAt?: string; createdAt: string; author: Author; reactions: Reaction[]; }
interface GroupData { id: string; name: string; emoji: string; inviteCode: string; description?: string; role?: string; openInvite?: boolean; }
interface Member { id: string; name: string; avatar?: string; email: string; role: string; joinedAt: string; }

const REACTION_OPTIONS = ['❤️', '😂', '🔥', '👀', '😮', '👍'];
const EMOJI_OPTIONS = ['🔗','🎮','🎵','🎬','📚','💡','🏆','🌍','🍕','😂','🔥','💬','📸','🎨','⚽','🐦','🚀','🛠️','💎','🌙'];

function avatarColor(name: string) {
  const colors = ['#5b6af7','#e05c9a','#f97316','#22c55e','#06b6d4','#a855f7','#eab308','#ef4444'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function AuthorAvatar({ author }: { author: Author }) {
  const [imgFailed, setImgFailed] = useState(false);
  const initial = (author.name ?? '?')[0].toUpperCase();
  const bg = avatarColor(author.name ?? '');
  if (author.avatar && !imgFailed) {
    return <img src={author.avatar} alt={author.name} onError={() => setImgFailed(true)}
      style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1.5px solid var(--color-border)' }} />;
  }
  return <div style={{ width: 28, height: 28, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#fff', flexShrink: 0, border: '1.5px solid var(--color-border)' }}>{initial}</div>;
}

const ROLE_BADGE: Record<string, React.CSSProperties> = {
  owner: { background: 'rgba(234,179,8,0.15)', color: '#ca8a04', border: '1px solid rgba(234,179,8,0.3)' },
  admin: { background: 'rgba(91,106,247,0.15)', color: 'var(--color-accent, #5b6af7)', border: '1px solid rgba(91,106,247,0.3)' },
  member: { background: 'var(--color-surface-2)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' },
};

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
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmoji, setEditEmoji] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editOpenInvite, setEditOpenInvite] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editMsg, setEditMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [showMembers, setShowMembers] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [removingMember, setRemovingMember] = useState<string | null>(null);

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

  useEffect(() => {
    if (status !== 'authenticated') return;
    const interval = setInterval(loadPosts, 15000);
    return () => clearInterval(interval);
  }, [status, loadPosts]);

  function openEdit() {
    if (!group) return;
    setEditName(group.name); setEditEmoji(group.emoji);
    setEditDesc(group.description ?? ''); setEditOpenInvite(group.openInvite ?? false);
    setEditMsg(null); setShowEdit(true);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault(); setEditLoading(true); setEditMsg(null);
    const res = await fetch(`/api/groups/${groupId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName, emoji: editEmoji, description: editDesc, openInvite: editOpenInvite }),
    });
    const data = await res.json(); setEditLoading(false);
    if (!res.ok) return setEditMsg({ type: 'err', text: data.error ?? 'Something went wrong' });
    setGroup(prev => prev ? { ...prev, name: data.name, emoji: data.emoji, description: data.description, openInvite: data.openInvite } : prev);
    setEditMsg({ type: 'ok', text: 'Group updated!' });
    setTimeout(() => setShowEdit(false), 800);
  }

  async function openMembers() {
    setShowMembers(true);
    if (members.length > 0) return;
    setMembersLoading(true);
    const res = await fetch(`/api/groups/${groupId}/members`);
    if (res.ok) setMembers(await res.json());
    setMembersLoading(false);
  }

  async function removeMember(targetId: string) {
    setRemovingMember(targetId);
    const res = await fetch(`/api/groups/${groupId}/members`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId: targetId }),
    });
    if (res.ok) setMembers(prev => prev.filter(m => m.id !== targetId));
    setRemovingMember(null);
  }

  async function submitPost(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setPosting(true);
    const res = await fetch(`/api/groups/${groupId}/posts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url.trim(), note: note.trim() || undefined }),
    });
    if (res.ok) { const post = await res.json(); setPosts(prev => [post, ...prev]); setUrl(''); setNote(''); }
    setPosting(false);
  }

  async function submitUpload() {
    if (!uploadFile) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', uploadFile);
    if (note.trim()) fd.append('note', note.trim());
    const res = await fetch(`/api/groups/${groupId}/upload`, { method: 'POST', body: fd });
    if (res.ok) { const post = await res.json(); setPosts(prev => [post, ...prev]); setUploadFile(null); setNote(''); }
    else { const d = await res.json(); alert(d.error ?? 'Upload failed'); }
    setUploading(false);
  }

  async function deletePost(postId: string) {
    if (!confirm('Delete this post? This cannot be undone.')) return;
    setDeletingId(postId);
    const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE' });
    if (res.ok) setPosts(prev => prev.filter(p => p.id !== postId));
    else { const d = await res.json(); alert(d.error ?? 'Could not delete post'); }
    setDeletingId(null);
  }

  async function toggleReaction(postId: string, emoji: string) {
    const res = await fetch(`/api/posts/${postId}/reactions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
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

  function expiresIn(date: string) {
    const days = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
    if (days <= 0) return 'Expires soon';
    return `Expires in ${days}d`;
  }

  if (status === 'loading' || !group) return <div style={{ padding: '2rem', color: 'var(--color-text-muted)' }}>Loading...</div>;

  const isOwner = group.role === 'owner';
  const canEdit = isOwner || group.role === 'admin';
  const canInvite = isOwner || (group.openInvite ?? false);

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
                    <button key={em} type="button" onClick={() => setEditEmoji(em)}
                      style={{ width: 38, height: 38, fontSize: '1.2rem', borderRadius: 'var(--radius-sm)', border: `2px solid ${editEmoji === em ? 'var(--color-accent)' : 'var(--color-border)'}`, background: editEmoji === em ? 'rgba(91,106,247,0.15)' : 'var(--color-surface-2)', cursor: 'pointer', transition: 'all 0.12s' }}>{em}</button>
                  ))}
                </div>
                <input value={editEmoji} onChange={e => setEditEmoji(e.target.value)} placeholder="Or type any emoji" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.4rem' }}>Description <span style={{ opacity: 0.5 }}>(optional)</span></label>
                <input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="What's this group about?" />
              </div>
              {isOwner && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                  <input type="checkbox" checked={editOpenInvite} onChange={e => setEditOpenInvite(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: 'var(--color-accent, #5b6af7)', cursor: 'pointer' }} />
                  <span>Allow any member to invite others</span>
                </label>
              )}
              {editMsg && (
                <div style={{ padding: '0.6rem 0.9rem', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', background: editMsg.type === 'ok' ? 'rgba(91,106,247,0.12)' : 'rgba(224,92,92,0.12)', color: editMsg.type === 'ok' ? 'var(--color-accent)' : 'var(--color-danger)' }}>
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

      {/* Members Modal */}
      {showMembers && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', padding: '1rem' }}
          onClick={e => { if (e.target === e.currentTarget) setShowMembers(false); }}>
          <div style={{ width: '100%', maxWidth: 480, background: 'var(--color-surface)', borderRadius: 'var(--radius-xl) var(--radius-xl) var(--radius-lg) var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden', maxHeight: '70vh', display: 'flex', flexDirection: 'column', animation: 'slideUp 0.2s cubic-bezier(0.16,1,0.3,1)' }}>
            <style>{`@keyframes slideUp { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }`}</style>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-border)' }}>
              <div>
                <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>Members</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{members.length} {members.length === 1 ? 'person' : 'people'} in this group</p>
              </div>
              <button onClick={() => setShowMembers(false)} style={{ color: 'var(--color-text-muted)', fontSize: '1.2rem', lineHeight: 1, padding: '0.25rem' }}>✕</button>
            </div>
            <div style={{ overflowY: 'auto', padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {membersLoading && <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', padding: '1rem 0', textAlign: 'center' }}>Loading...</p>}
              {members.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>
                  {m.avatar
                    ? <img src={m.avatar} alt={m.name} style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    : <div style={{ width: 34, height: 34, borderRadius: '50%', background: avatarColor(m.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, color: '#fff', flexShrink: 0 }}>{m.name[0].toUpperCase()}</div>
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{m.name}{m.id === userId && <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', fontSize: '0.8rem' }}> (you)</span>}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Joined {new Date(m.joinedAt).toLocaleDateString()}</div>
                  </div>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-full)', textTransform: 'capitalize', ...ROLE_BADGE[m.role] ?? ROLE_BADGE.member }}>
                    {m.role}
                  </span>
                  {isOwner && m.id !== userId && (
                    <button onClick={() => removeMember(m.id)} disabled={removingMember === m.id}
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(224,92,92,0.3)', background: 'rgba(224,92,92,0.08)', color: 'var(--color-danger, #e05c5c)', cursor: 'pointer', flexShrink: 0 }}>
                      {removingMember === m.id ? '...' : 'Remove'}
                    </button>
                  )}
                </div>
              ))}
            </div>
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
          {canEdit && <button className="btn btn-ghost" onClick={openEdit} style={{ fontSize: '0.8rem' }}>⚙️ Edit</button>}
          <button className="btn btn-ghost" onClick={openMembers} style={{ fontSize: '0.8rem' }}>👥 Members</button>
          {canInvite && (
            <button className="btn btn-ghost" onClick={copyInvite} style={{ fontSize: '0.8rem' }}>{copied ? '✅ Copied!' : '🔗 Invite'}</button>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="card" style={{ marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {uploadFile ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.75rem', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem' }}>
            <span>{uploadFile.type.startsWith('video') ? '🎬' : '🖼️'}</span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{uploadFile.name}</span>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>{(uploadFile.size / 1024 / 1024).toFixed(1)}MB</span>
            <button onClick={() => setUploadFile(null)} style={{ color: 'var(--color-text-muted)', fontSize: '1rem' }}>✕</button>
          </div>
        ) : (
          <form onSubmit={submitPost} style={{ display: 'contents' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input type="url" placeholder="Paste a link..." value={url} onChange={e => setUrl(e.target.value)} required style={{ fontSize: '0.95rem', flex: 1 }} />
              <button type="button" onClick={() => fileInputRef.current?.click()}
                title="Upload a video or image"
                style={{ padding: '0 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', fontSize: '1.1rem', cursor: 'pointer', flexShrink: 0 }}>
                📎
              </button>
            </div>
          </form>
        )}
        <input placeholder="Add a note (optional)" value={note} onChange={e => setNote(e.target.value)} />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          {uploadFile ? (
            <button className="btn btn-primary" onClick={submitUpload} disabled={uploading}>
              {uploading ? 'Uploading...' : 'Drop It 📎'}
            </button>
          ) : (
            <button type="submit" form="link-form" className="btn btn-primary" disabled={posting || !url.trim()}
              onClick={async e => { e.preventDefault(); await submitPost(e as any); }}>
              {posting ? 'Sharing...' : 'Drop It 🔗'}
            </button>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept="video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/gif,image/webp"
          style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) setUploadFile(f); e.target.value = ''; }} />
      </div>

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
            const isMyPost = post.author.id === userId;
            return (
              <div key={post.id} className="card" style={{ padding: '0.9rem', opacity: deletingId === post.id ? 0.5 : 1, transition: 'opacity 0.2s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AuthorAvatar author={post.author} />
                    <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text)' }}>{post.author.name}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    {post.expiresAt && <span style={{ fontSize: '0.72rem', color: 'var(--color-text-faint)' }}>⏳ {expiresIn(post.expiresAt)}</span>}
                    <span>{timeAgo(post.createdAt)}</span>
                    {isMyPost && (
                      <button onClick={() => deletePost(post.id)} disabled={deletingId === post.id} title="Delete post"
                        style={{ color: 'var(--color-danger, #e05c5c)', fontSize: '0.8rem', opacity: 0.6, cursor: 'pointer', padding: '0 0.2rem', lineHeight: 1, background: 'none', border: 'none', transition: 'opacity 0.12s' }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}>
                        🗑️
                      </button>
                    )}
                  </div>
                </div>

                {post.note && <p style={{ marginBottom: '0.6rem', fontSize: '0.9rem' }}>{post.note}</p>}

                {post.uploadType === 'video' && post.uploadUrl && (
                  <video controls style={{ width: '100%', borderRadius: 8, marginBottom: '0.5rem', maxHeight: 400, background: '#000' }}>
                    <source src={post.uploadUrl} />
                  </video>
                )}
                {post.uploadType === 'image' && post.uploadUrl && (
                  <div style={{ position: 'relative', width: '100%', marginBottom: '0.5rem' }}>
                    <img src={post.uploadUrl} alt="uploaded" style={{ width: '100%', borderRadius: 8, maxHeight: 500, objectFit: 'cover' }} />
                  </div>
                )}

                {!post.uploadUrl && post.url && (
                  hasEmbed ? <PostEmbed url={post.url} /> : (
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
                  )
                )}

                {hasEmbed && post.url && (
                  <a href={post.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.4rem' }}>
                    ↗ Open in {embed.type.charAt(0).toUpperCase() + embed.type.slice(1)}
                  </a>
                )}

                <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.65rem', flexWrap: 'wrap' }}>
                  {REACTION_OPTIONS.map(emoji => (
                    <button key={emoji} onClick={() => toggleReaction(post.id, emoji)}
                      style={{ padding: '0.25rem 0.55rem', borderRadius: 20, fontSize: '0.85rem', border: `1px solid ${myReactions.has(emoji) ? 'var(--color-accent)' : 'var(--color-border)'}`, background: myReactions.has(emoji) ? 'rgba(91,106,247,0.15)' : 'transparent', color: 'var(--color-text)', transition: 'all 0.12s', cursor: 'pointer' }}>
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
