'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { timeAgo, isoDate, fullDate } from '@/lib/timeAgo';

interface CommentAuthor { id: string; name: string; avatar?: string; }
interface Comment { id: string; body: string; createdAt: string; author: CommentAuthor; }

interface Props {
  postId: string;
  currentUserId: string;
  postAuthorId: string;
  userRole?: string; // 'owner' | 'admin' | 'member'
  initialCount?: number;
}

function avatarColor(name: string) {
  const colors = ['#5b6af7','#e05c9a','#f97316','#22c55e','#06b6d4','#a855f7','#eab308','#ef4444'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function Avatar({ author }: { author: CommentAuthor }) {
  const [failed, setFailed] = useState(false);
  const bg = avatarColor(author.name ?? '');
  const initial = (author.name ?? '?')[0].toUpperCase();
  if (author.avatar && !failed) {
    return <img src={author.avatar} alt={author.name} onError={() => setFailed(true)}
      style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1.5px solid var(--color-border)' }} />;
  }
  return <div style={{ width: 24, height: 24, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, color: '#fff', flexShrink: 0, border: '1.5px solid var(--color-border)' }}>{initial}</div>;
}

export default function CommentThread({ postId, currentUserId, postAuthorId, userRole, initialCount = 0 }: Props) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [count, setCount] = useState(initialCount);
  const [loaded, setLoaded] = useState(false);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

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
    if (open && !loaded) load();
  }, [open, loaded, load]);

  // Scroll to bottom when thread opens or new comment added
  useEffect(() => {
    if (open) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
  }, [open, comments.length]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || submitting) return;
    setSubmitting(true);
    setError(null);

    // Optimistic
    const optimistic: Comment = {
      id: `optimistic-${Date.now()}`,
      body: body.trim(),
      createdAt: new Date().toISOString(),
      author: { id: currentUserId, name: 'You', avatar: undefined },
    };
    setComments(prev => [...prev, optimistic]);
    setCount(c => c + 1);
    setBody('');

    const res = await fetch(`/api/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: optimistic.body }),
    });

    if (res.ok) {
      const real: Comment = await res.json();
      setComments(prev => prev.map(c => c.id === optimistic.id ? real : c));
    } else {
      // Rollback
      setComments(prev => prev.filter(c => c.id !== optimistic.id));
      setCount(c => c - 1);
      const d = await res.json();
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

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit(e as any);
    }
  }

  const canDelete = (comment: Comment) =>
    comment.author.id === currentUserId ||
    postAuthorId === currentUserId ||
    userRole === 'owner' ||
    userRole === 'admin';

  return (
    <div style={{ marginTop: '0.5rem' }}>
      {/* Toggle button */}
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

      {/* Thread panel */}
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

          {/* Comment list */}
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
                <p style={{ fontSize: '0.85rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>{comment.body}</p>
              </div>
            </div>
          ))}

          <div ref={bottomRef} />

          {/* Composer */}
          {error && <p style={{ fontSize: '0.78rem', color: 'var(--color-danger, #e05c5c)' }}>{error}</p>}
          <form onSubmit={submit} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
            <textarea
              ref={inputRef}
              value={body}
              onChange={e => setBody(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Write a comment… (Enter to send, Shift+Enter for newline)"
              rows={1}
              disabled={submitting}
              style={{
                flex: 1,
                resize: 'none',
                fontSize: '0.85rem',
                padding: '0.45rem 0.7rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface-2)',
                color: 'var(--color-text)',
                outline: 'none',
                lineHeight: 1.5,
                transition: 'border-color 0.12s',
                fontFamily: 'inherit',
                minHeight: 36,
                maxHeight: 120,
                overflowY: 'auto',
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
      )}
    </div>
  );
}
