'use client';
import { useEffect, useRef, useState } from 'react';
import { getEmbed } from '@/lib/embed';

interface Props {
  url: string;
}

/** Returns true once the element is within 200px of the viewport. */
function useInView(ref: React.RefObject<HTMLElement | null>): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (inView) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
      { rootMargin: '200px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref, inView]);
  return inView;
}

function Skeleton({ height = 200 }: { height?: number }) {
  return (
    <div style={{
      height,
      borderRadius: 8,
      background: 'var(--color-surface-2)',
      marginBottom: '0.5rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '0.8rem',
      color: 'var(--color-text-muted)',
    }} />
  );
}

function TikTokEmbed({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  // Only fetch oembed once the post is near the viewport
  useEffect(() => {
    if (!inView) return;
    fetch(`/api/tiktok-oembed?url=${encodeURIComponent(url)}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        if (data.videoId) setVideoId(data.videoId);
        else setFailed(true);
      })
      .catch(() => setFailed(true));
  }, [inView, url]);

  if (failed) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer"
        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', fontSize: '0.875rem', color: 'var(--color-text)', marginBottom: '0.5rem', textDecoration: 'none' }}>
        <span style={{ fontSize: '1.3rem' }}>🎵</span>
        <span style={{ flex: 1 }}>View TikTok video ↗</span>
      </a>
    );
  }

  // Always render the container div so the IntersectionObserver has a target
  return (
    <div ref={containerRef} style={{ marginBottom: '0.5rem' }}>
      {(!inView || !videoId) ? (
        <div style={{
          height: 560,
          borderRadius: 8,
          background: 'var(--color-surface-2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.8rem',
          color: 'var(--color-text-muted)',
        }}>
          {inView && !videoId ? 'Loading TikTok…' : ''}
        </div>
      ) : (
        <div style={{
          position: 'relative',
          width: '100%',
          maxWidth: 340,
          margin: '0 auto',
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
          />
        </div>
      )}
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

  return (
    <div style={{ borderRadius: 8, overflow: 'hidden', marginBottom: '0.5rem', background: '#000' }}>
      {/* muted is required for autoPlay to work in Chrome/Safari — user can unmute via controls */}
      <video
        src={videoUrl}
        controls
        playsInline
        autoPlay
        muted
        preload="metadata"
        style={{ width: '100%', maxHeight: 520, display: 'block' }}
      />
    </div>
  );
}

function LazyIframe({
  src,
  title,
  height,
  aspectRatio = '16/9',
  allow,
  style,
}: {
  src: string;
  title: string;
  height?: number;
  aspectRatio?: string;
  allow?: string;
  style?: React.CSSProperties;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef);

  const wrapperStyle: React.CSSProperties = height
    ? { height, borderRadius: 8, overflow: 'hidden', marginBottom: '0.5rem' }
    : { position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: 8, marginBottom: '0.5rem' };

  const iframeStyle: React.CSSProperties = height
    ? { width: '100%', height: '100%', border: 'none', borderRadius: 12, ...style }
    : { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none', ...style };

  return (
    <div ref={containerRef} style={wrapperStyle}>
      {inView ? (
        <iframe
          src={src}
          style={iframeStyle}
          allowFullScreen
          allow={allow ?? 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'}
          title={title}
        />
      ) : (
        <div style={{
          position: height ? undefined : 'absolute',
          inset: height ? undefined : 0,
          width: '100%',
          height: height ? '100%' : undefined,
          background: 'var(--color-surface-2)',
          borderRadius: 8,
        }} />
      )}
    </div>
  );
}

export default function PostEmbed({ url }: Props) {
  const embed = getEmbed(url);
  const twitterRef = useRef<HTMLDivElement>(null);
  const twitterInView = useInView(twitterRef);
  // Prevent Twitter widgets.load() from firing more than once per mount,
  // which would cause duplicate tweet embeds to stack.
  const twitterRendered = useRef(false);

  useEffect(() => {
    if (embed.type !== 'twitter' || !twitterInView) return;
    if (twitterRendered.current) return;
    twitterRendered.current = true;

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
  }, [embed.type, twitterInView, url]);

  if (embed.type === 'none') return null;
  if (embed.type === 'tiktok') return <TikTokEmbed url={url} />;
  if (embed.type === 'facebook-video') return <FacebookVideoEmbed url={url} />;

  if (embed.type === 'twitter') {
    return (
      <div ref={twitterRef} style={{ marginBottom: '0.5rem' }}>
        {twitterInView && (
          <blockquote className="twitter-tweet" data-dnt="true">
            <a href={url}>View Tweet</a>
          </blockquote>
        )}
      </div>
    );
  }

  if (embed.type === 'spotify') {
    const isTrack = embed.embedUrl?.includes('/track/');
    const height = isTrack ? 80 : 380;
    return (
      <LazyIframe
        src={embed.embedUrl!}
        title="Spotify player"
        height={height}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      />
    );
  }

  // YouTube, Twitch, and all other iframes
  return (
    <LazyIframe
      src={embed.embedUrl!}
      title="Embedded content"
    />
  );
}
