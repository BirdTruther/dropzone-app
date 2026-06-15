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

function TikTokEmbed({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

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

  return (
    <div ref={containerRef} style={{ marginBottom: '0.5rem' }}>
      {(!inView || !videoId) ? (
        <div style={{ height: 560, borderRadius: 8, background: 'var(--color-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
          {inView && !videoId ? 'Loading TikTok…' : ''}
        </div>
      ) : (
        <div style={{ position: 'relative', width: '100%', maxWidth: 340, margin: '0 auto', borderRadius: 12, overflow: 'hidden', background: '#000', aspectRatio: '9/16' }}>
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

// 'verifying' = poll said ready, HEAD-checking the file is fully servable
type FBState = 'checking' | 'pending' | 'verifying' | 'ready' | 'error';

const POLL_INTERVAL = 4000;
const MAX_POLLS = 75;
// How many times to retry the HEAD check before giving up
const MAX_HEAD_RETRIES = 5;
const HEAD_RETRY_DELAY = 800;

function FacebookVideoEmbed({ url }: { url: string }) {
  const stateRef = useRef<FBState>('checking');
  const [displayState, setDisplayState] = useState<FBState>('checking');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const pollCount = useRef(0);
  const headRetries = useRef(0);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const postFired = useRef(false);

  function setFBState(s: FBState) {
    stateRef.current = s;
    setDisplayState(s);
  }

  function scheduleNextPoll(delayMs = POLL_INTERVAL) {
    if (pollTimer.current) clearTimeout(pollTimer.current);
    pollTimer.current = setTimeout(doCheck, delayMs);
  }

  /**
   * HEAD-verify the video URL so the browser never sees a partially-written file.
   * Retries up to MAX_HEAD_RETRIES times with HEAD_RETRY_DELAY ms between attempts.
   * Only sets state to 'ready' once the server confirms Content-Type: video/mp4.
   */
  function verifyAndShow(vUrl: string) {
    setFBState('verifying');
    function attempt() {
      fetch(vUrl, { method: 'HEAD' })
        .then(res => {
          const ct = res.headers.get('content-type') ?? '';
          if (res.ok && ct.includes('video')) {
            // File is fully written and correctly typed — safe to show the player
            setVideoUrl(vUrl);
            setFBState('ready');
          } else if (headRetries.current < MAX_HEAD_RETRIES) {
            headRetries.current += 1;
            pollTimer.current = setTimeout(attempt, HEAD_RETRY_DELAY);
          } else {
            // Fallback: show anyway — player will handle it
            setVideoUrl(vUrl);
            setFBState('ready');
          }
        })
        .catch(() => {
          if (headRetries.current < MAX_HEAD_RETRIES) {
            headRetries.current += 1;
            pollTimer.current = setTimeout(attempt, HEAD_RETRY_DELAY);
          } else {
            setVideoUrl(vUrl);
            setFBState('ready');
          }
        });
    }
    attempt();
  }

  const doCheckRef = useRef<() => void>(() => {});
  doCheckRef.current = function doCheck() {
    if (stateRef.current === 'ready' || stateRef.current === 'error' || stateRef.current === 'verifying') return;

    if (pollCount.current >= MAX_POLLS) {
      setFBState('error');
      setErrorMsg('Video is taking too long to process. Try opening it on Facebook directly.');
      return;
    }
    pollCount.current += 1;

    fetch(`/api/fetch-facebook?url=${encodeURIComponent(url)}`)
      .then(r => r.json())
      .then((data: any) => {
        if (data.status === 'ready' && data.url) {
          // Don't show the player yet — HEAD-verify first
          headRetries.current = 0;
          verifyAndShow(data.url);
        } else if (data.status === 'pending') {
          setFBState('pending');
          scheduleNextPoll();
        } else if (data.status === 'not_started') {
          if (!postFired.current) {
            postFired.current = true;
            fetch('/api/fetch-facebook', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url }),
            }).catch(() => {});
          }
          setFBState('pending');
          scheduleNextPoll();
        } else if (data.error) {
          setErrorMsg(data.error);
          setFBState('error');
        } else {
          scheduleNextPoll();
        }
      })
      .catch(() => scheduleNextPoll());
  };

  function doCheck() { doCheckRef.current(); }

  useEffect(() => {
    const jitter = Math.random() * 800;
    pollTimer.current = setTimeout(doCheck, jitter);
    return () => { if (pollTimer.current) clearTimeout(pollTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  function retryDownload() {
    postFired.current = false;
    pollCount.current = 0;
    headRetries.current = 0;
    setErrorMsg(null);
    setVideoUrl(null);
    setFBState('checking');
    if (pollTimer.current) clearTimeout(pollTimer.current);
    fetch('/api/fetch-facebook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    }).catch(() => {});
    scheduleNextPoll(2000);
  }

  if (displayState === 'error') {
    return (
      <div style={{ marginBottom: '0.5rem' }}>
        <a href={url} target="_blank" rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', fontSize: '0.875rem', color: 'var(--color-text)', textDecoration: 'none' }}>
          <span style={{ fontSize: '1.3rem' }}>📹</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>View on Facebook ↗</div>
            {errorMsg && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{errorMsg}</div>}
          </div>
        </a>
        <button onClick={retryDownload}
          style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          ↻ Retry download
        </button>
      </div>
    );
  }

  if (displayState === 'ready' && videoUrl) {
    return (
      <div style={{ borderRadius: 8, overflow: 'hidden', marginBottom: '0.5rem', background: '#000' }}>
        <video
          src={videoUrl}
          controls
          playsInline
          preload="none"
          style={{ width: '100%', maxHeight: 520, display: 'block' }}
        />
      </div>
    );
  }

  // checking / pending / verifying — spinner
  return (
    <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, borderRadius: 8, marginBottom: '0.5rem', background: 'var(--color-surface-2)', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
          style={{ opacity: 0.5, animation: 'fbSpin 1.2s linear infinite' }}>
          <circle cx="12" cy="12" r="10" strokeDasharray="40 20" />
        </svg>
        {displayState === 'checking' ? 'Loading…' : 'Preparing Facebook video…'}
        <style>{`@keyframes fbSpin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

function LazyIframe({
  src, title, height, allow, style,
}: {
  src: string; title: string; height?: number; allow?: string; style?: React.CSSProperties;
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
        <iframe src={src} style={iframeStyle} allowFullScreen
          allow={allow ?? 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'}
          title={title} />
      ) : (
        <div style={{ position: height ? undefined : 'absolute', inset: height ? undefined : 0, width: '100%', height: height ? '100%' : undefined, background: 'var(--color-surface-2)', borderRadius: 8 }} />
      )}
    </div>
  );
}

export default function PostEmbed({ url }: Props) {
  const embed = getEmbed(url);
  const twitterRef = useRef<HTMLDivElement>(null);
  const twitterInView = useInView(twitterRef);
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
    return (
      <LazyIframe src={embed.embedUrl!} title="Spotify player" height={isTrack ? 80 : 380}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" />
    );
  }

  return <LazyIframe src={embed.embedUrl!} title="Embedded content" />;
}
