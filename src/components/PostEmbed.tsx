'use client';
import { useEffect, useRef, useState } from 'react';
import { getEmbed } from '@/lib/embed';

interface Props {
  url: string;
}

function TikTokEmbed({ url }: { url: string }) {
  const [videoId, setVideoId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(`/api/tiktok-oembed?url=${encodeURIComponent(url)}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        if (data.videoId) setVideoId(data.videoId);
        else setFailed(true);
      })
      .catch(() => setFailed(true));
  }, [url]);

  if (failed) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer"
        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', fontSize: '0.875rem', color: 'var(--color-text)', marginBottom: '0.5rem', textDecoration: 'none' }}>
        <span style={{ fontSize: '1.3rem' }}>🎵</span>
        <span style={{ flex: 1 }}>View TikTok video ↗</span>
      </a>
    );
  }

  if (!videoId) {
    return (
      <div style={{ height: 560, borderRadius: 8, background: 'var(--color-surface-2)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
        Loading TikTok...
      </div>
    );
  }

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      maxWidth: 340,
      margin: '0 auto 0.5rem',
      borderRadius: 12,
      overflow: 'hidden',
      background: '#000',
      aspectRatio: '9/16',
    }}>
      <iframe
        src={`https://www.tiktok.com/embed/v2/${videoId}?autoplay=0`}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
        allowFullScreen
        allow="autoplay; encrypted-media"
        title="TikTok video"
        loading="lazy"
      />
    </div>
  );
}

// States: idle → loading → ready | error
type FBState = 'idle' | 'loading' | 'ready' | 'error';

function FacebookVideoEmbed({ url }: { url: string }) {
  const [state, setState] = useState<FBState>('idle');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function load() {
    if (state === 'loading') return;
    setState('loading');
    setErrorMsg(null);
    fetch('/api/fetch-facebook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
      .then(r => r.ok ? r.json() : r.json().then((d: any) => Promise.reject(d.error ?? 'Failed')))
      .then((data: any) => { setVideoUrl(data.url); setState('ready'); })
      .catch((err: any) => { setErrorMsg(typeof err === 'string' ? err : 'Could not load video.'); setState('error'); });
  }

  // Idle — click to load card
  if (state === 'idle') {
    return (
      <button
        onClick={load}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          width: '100%', padding: '0.85rem 1rem',
          borderRadius: 8, border: '1px solid var(--color-border)',
          background: 'var(--color-surface-2)',
          cursor: 'pointer', marginBottom: '0.5rem',
          textAlign: 'left',
        }}
      >
        <span style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: '50%',
          background: '#1877f2', flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
            <polygon points="5 3 19 12 5 21 5 3" fill="#fff" stroke="none" />
          </svg>
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text)' }}>Load Facebook video</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>Tap to download and play</div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </button>
    );
  }

  // Loading
  if (state === 'loading') {
    return (
      <div style={{
        position: 'relative', paddingBottom: '56.25%', height: 0,
        borderRadius: 8, marginBottom: '0.5rem',
        background: 'var(--color-surface-2)', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.82rem',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
            style={{ opacity: 0.5, animation: 'spin 1.2s linear infinite' }}>
            <circle cx="12" cy="12" r="10" strokeDasharray="40 20" />
          </svg>
          Downloading Facebook video…
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  // Error — show fallback link + retry
  if (state === 'error' || !videoUrl) {
    return (
      <div style={{ marginBottom: '0.5rem' }}>
        <a href={url} target="_blank" rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.75rem', borderRadius: 8,
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface-2)',
            fontSize: '0.875rem', color: 'var(--color-text)',
            textDecoration: 'none',
          }}>
          <span style={{ fontSize: '1.3rem' }}>📹</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>View on Facebook ↗</div>
            {errorMsg && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{errorMsg}</div>}
          </div>
        </a>
        <button onClick={load}
          style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          ↻ Retry download
        </button>
      </div>
    );
  }

  // Ready
  return (
    <div style={{ borderRadius: 8, overflow: 'hidden', marginBottom: '0.5rem', background: '#000' }}>
      <video
        src={videoUrl}
        controls
        playsInline
        autoPlay
        preload="metadata"
        style={{ width: '100%', maxHeight: 520, display: 'block' }}
      />
    </div>
  );
}

export default function PostEmbed({ url }: Props) {
  const embed = getEmbed(url);
  const twitterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (embed.type === 'twitter' && twitterRef.current) {
      if (!(window as any).twttr) {
        const script = document.createElement('script');
        script.src = 'https://platform.twitter.com/widgets.js';
        script.async = true;
        script.charset = 'utf-8';
        document.body.appendChild(script);
        script.onload = () => (window as any).twttr?.widgets?.load(twitterRef.current!);
      } else {
        (window as any).twttr?.widgets?.load(twitterRef.current);
      }
    }
  }, [embed.type, url]);

  if (embed.type === 'none') return null;
  if (embed.type === 'tiktok') return <TikTokEmbed url={url} />;
  if (embed.type === 'facebook-video') return <FacebookVideoEmbed url={url} />;

  if (embed.type === 'twitter') {
    return (
      <div ref={twitterRef} style={{ marginBottom: '0.5rem' }}>
        <blockquote className="twitter-tweet" data-dnt="true">
          <a href={url}>View Tweet</a>
        </blockquote>
      </div>
    );
  }

  if (embed.type === 'spotify') {
    const isTrack = embed.embedUrl?.includes('/track/');
    const height = isTrack ? 80 : 380;
    return (
      <iframe
        src={embed.embedUrl}
        width="100%"
        height={height}
        style={{ border: 'none', borderRadius: 12, marginBottom: '0.5rem' }}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
        title="Spotify player"
      />
    );
  }

  return (
    <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: 8, marginBottom: '0.5rem' }}>
      <iframe
        src={embed.embedUrl}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
        allowFullScreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        loading="lazy"
        title="Embedded content"
      />
    </div>
  );
}
