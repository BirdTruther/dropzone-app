'use client';
import { useEffect, useRef, useState } from 'react';

interface Props {
  postId: string;
  groupId: string;
  initialStatus: string | null | undefined;
  uploadUrl: string;
}

/**
 * Renders an uploaded video with three states:
 *  - processing: animated bar + "Converting video…", polls status every 2.5s
 *  - error:      error message with link fallback
 *  - ready/null: normal <video> player
 */
export default function UploadedVideo({ postId, groupId, initialStatus, uploadUrl }: Props) {
  const [status, setStatus] = useState<string | null>(initialStatus ?? null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [dots, setDots] = useState(0);

  // Animated ellipsis while processing
  useEffect(() => {
    if (status !== 'processing') return;
    const t = setInterval(() => setDots(d => (d + 1) % 4), 500);
    return () => clearInterval(t);
  }, [status]);

  // Poll until ready or error
  useEffect(() => {
    if (status !== 'processing') {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/groups/${groupId}/upload/status/${postId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.uploadStatus === 'ready' || data.uploadStatus === 'error') {
          setStatus(data.uploadStatus);
        }
      } catch {
        // network hiccup — keep polling
      }
    }, 2500);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [status, postId, groupId]);

  if (status === 'processing') {
    return (
      <div style={{
        width: '100%',
        borderRadius: 8,
        marginBottom: '0.5rem',
        background: 'var(--color-surface-2)',
        border: '1px solid var(--color-border)',
        padding: '1.25rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.75rem',
      }}>
        {/* Spinner */}
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2"
          style={{ animation: 'spin 1.2s linear infinite', flexShrink: 0 }}>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <circle cx="12" cy="12" r="10" strokeDasharray="40 20" />
        </svg>
        {/* Progress bar (indeterminate) */}
        <div style={{ width: '100%', height: 4, borderRadius: 999, background: 'var(--color-border)', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            borderRadius: 999,
            background: 'var(--color-primary)',
            animation: 'indeterminate 1.6s ease-in-out infinite',
            width: '40%',
          }} />
          <style>{`@keyframes indeterminate { 0%{transform:translateX(-100%)} 100%{transform:translateX(350%)} }`}</style>
        </div>
        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
          Converting video{'.' .repeat(dots + 1)}
        </span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div style={{
        width: '100%',
        borderRadius: 8,
        marginBottom: '0.5rem',
        background: 'rgba(224,92,92,0.08)',
        border: '1px solid rgba(224,92,92,0.25)',
        padding: '0.9rem 1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.6rem',
      }}>
        <span style={{ fontSize: '1.2rem' }}>⚠️</span>
        <span style={{ fontSize: '0.85rem', color: 'var(--color-error, #e05c5c)' }}>
          Video conversion failed. The file format may not be supported.
        </span>
      </div>
    );
  }

  // ready or legacy null — render normal player
  return (
    <video
      controls
      playsInline
      preload="metadata"
      style={{ width: '100%', borderRadius: 8, marginBottom: '0.5rem', maxHeight: 400, background: '#000' }}
    >
      <source src={uploadUrl} type="video/mp4" />
    </video>
  );
}
