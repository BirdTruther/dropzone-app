'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { timeAgo, isoDate, fullDate } from '@/lib/timeAgo';

interface CommentAuthor { id: string; name: string; avatar?: string; }
interface Comment {
  id: string;
  body: string;
  createdAt: string;
  author: CommentAuthor;
  mentions?: string[];
}
interface GroupMember { id: string; name: string; avatar?: string; }

interface Props {
  postId: string;
  groupId: string;
  currentUserId: string;
  currentUserName: string;   // ← added: real name for optimistic comments
  currentUserAvatar?: string; // ← added: real avatar for optimistic comments
  postAuthorId: string;
  userRole?: string;
  initialCount?: number;
}

function avatarColor(name: string) {
  const colors = ['#5b6af7','#e05c9a','#f97316','#22c55e','#06b6d4','#a855f7','#eab308','#ef4444'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function Avatar({ author, size = 24 }: { author: GroupMember; size?: number }) {
  const [failed, setFailed] = useState(false);
  const bg = avatarColor(author.name ?? '');
  const initial = (author.name ?? '?')[0].toUpperCase();
  if (author.avatar && !failed) {
    return <img src={author.avatar} alt={author.name} onError={() => setFailed(true)}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1.5px solid var(--color-border)' }} />;
  }
  return <div style={{ width: size, height: size, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * 0.45) + 'px', fontWeight: 700, color: '#fff', flexShrink: 0, border: '1.5px solid var(--color-border)' }}>{initial}</div>;
}

// Render comment body with highlighted @mentions
function CommentBody({ body, mentions, members }: { body: string; mentions?: string[]; members: GroupMember[] }) {
  if (!mentions || mentions.length === 0) return <p style={{ fontSize: '0.85rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>{body}</p>;

  const memberMap = Object.fromEntries(members.map(m => [m.id, m.name]));
  const parts = body.split(/(@\[[^\]]+\]\([^)]+\))/g);
  return (
    <p style={{ fontSize: '0.85rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
      {parts.map((part, i) => {
        const match = part.match(/^@\[([^\]]+)\]\(([^)]+)\)$/);
        if (match) {
          const [, displayName] = match;
          return <span key={i} style={{ color: 'var(--color-accent, #5b6af7)', fontWeight: 600 }}>@{displayName}</span>;
        }
        return part;
      })}
    </p>
  );
}

export default function CommentThread({
  postId,
  groupId,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  postAuthorId,
  userRole,
  initialCount = 0,
}: Props) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [count, setCount] = useState(initialCount);
  const [loaded, setLoaded] = useState(false);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [members, setMembers] = useState<GroupMember[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number>(-1);
  const [pendingMentions, setPendingMentions] = useState<GroupMember[]>([]);
  const [mentionHighlight, setMentionHighlight] = useState(0);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/posts/${postId}/comments`);
    if (res.ok) {
      const data: Comment[] = await res.json();
      setComments(data);
      setCount(data.length);
      setLoaded(true);
    }
  }, [postId]);

  useEffect(() => {
    fetch(`/api/groups/${groupId}/members`)
      .then(r => r.ok ? r.json() : [])
      .then(setMembers)
      .catch(() => {});
  }, [groupId]);

  useEffect(() => {
    if (open && !loaded) load();
  }, [open, loaded, load]);

  useEffect(() => {
    if (open) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
  }, [open, comments.length]);

  const filteredMembers = mentionQuery !== null
    ? members.filter(m => m.id !== currentUserId && m.name.toLowerCase().includes(mentionQuery.toLowerCase()))
    : [];

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setBody(val);
    const cursor = e.target.selectionStart ?? val.length;
    const textBefore = val.slice(0, cursor);
    const atMatch = textBefore.match(/@([^\s@]*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1]);
      setMentionStart(cursor - atMatch[0].length);
      setMentionHighlight(0);
    } else {
      setMentionQuery(null);
    }
  }

  function selectMention(member: GroupMember) {
    const before = body.slice(0, mentionStart);
    const after = body.slice(inputRef.current?.selectionStart ?? body.length);
    const token = `@[${member.name}](${member.id})`;
    setBody(before + token + ' ' + after);
    setPendingMentions(prev => prev.some(m => m.id === member.id) ? prev : [...prev, member]);
    setMentionQuery(null);
    setTimeout(() => {
      inputRef.current?.focus();
      const pos = before.length + token.length + 1;
      inputRef.current?.setSelectionRange(pos, pos);
    }, 0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionQuery !== null && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionHighlight(h => Math.min(h + 1, filteredMembers.length - 1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setMentionHighlight(h => Math.max(h - 1, 0)); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); selectMention(filteredMembers[mentionHighlight]); return; }
      if (e.key === 'Escape') { setMentionQuery(null); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit(e as any);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    setMentionQuery(null);

    const mentionedUserIds = pendingMentions.map(m => m.id);

    // Use the real user name/avatar instead of the hardcoded 'You' placeholder
    const optimistic: Comment = {
      id: `optimistic-${Date.now()}`,
      body: body.trim(),
      createdAt: new Date().toISOString(),
      author: { id: currentUserId, name: currentUserName, avatar: currentUserAvatar },
      mentions: mentionedUserIds,
    };
    setComments(prev => [...prev, optimistic]);
    setCount(c => c + 1);
    setBody('');
    setPendingMentions([]);

    const res = await fetch(`/api/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: optimistic.body, mentionedUserIds }),
    });

    if (res.ok) {
      const real: Comment = await res.json();
      setComments(prev => prev.map(c => c.id === optimistic.id ? real : c));
    } else {
      // Roll back optimistic comment — capture current count to avoid
      // race-condition with concurrent submits
      setComments(prev => prev.filter(c => c.id !== optimistic.id));
      setCount(c => c - 1);
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? 'Failed to post comment');
    }
    setSubmitting(false);
  }

  async function deleteComment(commentId: string) {
    setDeletingId(commentId);
    const res = await fetch(`/api/posts/${postId}/comments/${commentId}`, { method: 'DELETE' });
    if (res.ok) {
      setComments(prev => prev.filter(c => c.id !== commentId));
      setCount(c => c - 1);
    }
    setDeletingId(null);
  }

  const canDelete = (comment: Comment) =>
    comment.author.id === currentUserId ||
    postAuthorId === currentUserId ||
    userRole === 'owner' ||
    userRole === 'admin';

  return (
    <div style={{ marginTop: '0.5rem' }}>
      <button
        onClick={() => { setOpen(o => !o); if (!open) setTimeout(() => inputRef.current?.focus(), 120); }}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: '0.8rem', color: 'var(--color-text-muted)',
          padding: '0.2rem 0', display: 'flex', alignItems: 'center', gap: '0.35rem',
          transition: 'color 0.12s',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-muted)')}
        aria-expanded={open}
      >
        <span>💬</span>
        <span>{count > 0 ? `${count} comment${count === 1 ? '' : 's'}` : 'Comment'}</span>
        <span style={{ fontSize: '0.65rem', opacity: 0.6, transition: 'transform 0.15s', display: 'inline-block', transform: open ? 'rotate(180deg)' : 'none' }}>▼</span>
      </button>

      {open && (
        <div style={{
          marginTop: '0.6rem',
          borderTop: '1px solid var(--color-border)',
          paddingTop: '0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem',
          animation: 'commentFadeIn 0.15s ease',
        }}>
          <style>{`
            @keyframes commentFadeIn {
              from { opacity: 0; transform: translateY(-4px); }
              to   { opacity: 1; transform: none; }
            }
          `}</style>

          {!loaded && (
            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', padding: '0.5rem 0' }}>Loading...</div>
          )}

          {loaded && comments.length === 0 && (
            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', padding: '0.25rem 0' }}>No comments yet. Be the first!</div>
          )}

          {comments.map(comment => (
            <div key={comment.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', opacity: deletingId === comment.id ? 0.4 : 1, transition: 'opacity 0.15s' }}>
              <Avatar author={comment.author} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginBottom: '0.15rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>{comment.author.name}</span>
                  <time
                    dateTime={isoDate(comment.createdAt)}
                    title={fullDate(comment.createdAt)}
                    style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', cursor: 'default' }}
                  >
                    {timeAgo(comment.createdAt)}
                  </time>
                  {canDelete(comment) && (
                    <button
                      onClick={() => deleteComment(comment.id)}
                      disabled={deletingId === comment.id}
                      title="Delete comment"
                      style={{
                        marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: '0.7rem', color: 'var(--color-text-faint)',
                        padding: '0 0.1rem', lineHeight: 1, transition: 'color 0.12s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-danger, #e05c5c)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-faint)')}
                    >✕</button>
                  )}
                </div>
                <CommentBody body={comment.body} mentions={comment.mentions} members={members} />
              </div>
            </div>
          ))}

          <div ref={bottomRef} />

          {error && <p style={{ fontSize: '0.78rem', color: 'var(--color-danger, #e05c5c)' }}>{error}</p>}

          <div style={{ position: 'relative' }}>
            {mentionQuery !== null && filteredMembers.length > 0 && (
              <div ref={dropdownRef} style={{
                position: 'absolute', bottom: '100%', left: 0, right: 0,
                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)',
                zIndex: 50, overflow: 'hidden', marginBottom: '4px',
              }}>
                {filteredMembers.map((member, idx) => (
                  <button
                    key={member.id}
                    onMouseDown={e => { e.preventDefault(); selectMention(member); }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.45rem 0.75rem', background: idx === mentionHighlight ? 'var(--color-surface-2)' : 'transparent',
                      border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s',
                    }}
                    onMouseEnter={() => setMentionHighlight(idx)}
                  >
                    <Avatar author={member} size={20} />
                    <span style={{ fontSize: '0.82rem', fontWeight: 500 }}>{member.name}</span>
                  </button>
                ))}
              </div>
            )}
            <form onSubmit={submit} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
              <textarea
                ref={inputRef}
                value={body}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                placeholder="Write a comment… (@ to mention, Enter to send)"
                rows={1}
                disabled={submitting}
                style={{
                  flex: 1, resize: 'none', fontSize: '0.85rem',
                  padding: '0.45rem 0.7rem', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)', background: 'var(--color-surface-2)',
                  color: 'var(--color-text)', outline: 'none', lineHeight: 1.5,
                  transition: 'border-color 0.12s', fontFamily: 'inherit',
                  minHeight: 36, maxHeight: 120, overflowY: 'auto',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-accent, #5b6af7)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
              />
              <button
                type="submit"
                disabled={!body.trim() || submitting}
                className="btn btn-primary"
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem', flexShrink: 0, opacity: !body.trim() || submitting ? 0.5 : 1 }}
              >
                {submitting ? '…' : 'Send'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
