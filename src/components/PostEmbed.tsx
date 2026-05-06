'use client';
import { useEffect, useRef, useState } from 'react';
import { getEmbed } from '@/lib/embed';

interface Props {
  url: string;
}

function TikTokEmbed({ url }: { url: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/tiktok-oembed?url=${encodeURIComponent(url)}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setHtml(data.html ?? null))
      .catch(() => setFailed(true));
  }, [url]);

  useEffect(() => {
    if (!html || !containerRef.current) return;
    // Inject TikTok embed script after HTML is set
    const existing = document.getElementById('tiktok-embed-script');
    if (existing) {
      (window as any).TikTok?.reload?.();
    } else {
      const script = document.createElement('script');
      script.id = 'tiktok-embed-script';
      script.src = 'https://www.tiktok.com/embed.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, [html]);

  if (failed) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer"
        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', fontSize: '0.875rem', color: 'var(--color-text)', marginBottom: '0.5rem', textDecoration: 'none' }}>
        <span style={{ fontSize: '1.3rem' }}>🎵</span>
        <span style={{ flex: 1 }}>View TikTok video ↗</span>
      </a>
    );
  }

  if (!html) {
    return (
      <div style={{ height: 80, borderRadius: 8, background: 'var(--color-surface-2)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
        Loading TikTok...
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ marginBottom: '0.5rem' }}
      dangerouslySetInnerHTML={{ __html: html }} />
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

  if (embed.type === 'tiktok') {
    return <TikTokEmbed url={url} />;
  }

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

  if (embed.type === 'facebook') {
    return (
      <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: 8, marginBottom: '0.5rem', background: '#000' }}>
        <iframe
          src={embed.embedUrl}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
          allowFullScreen
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
          loading="lazy"
          title="Facebook video"
        />
      </div>
    );
  }

  // YouTube, Twitch — standard 16:9
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
