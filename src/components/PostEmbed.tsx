'use client';
import { useEffect, useRef } from 'react';
import { getEmbed } from '@/lib/embed';

interface Props {
  url: string;
}

export default function PostEmbed({ url }: Props) {
  const embed = getEmbed(url);
  const twitterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (embed.type === 'twitter' && twitterRef.current) {
      // Load Twitter widget script if not already loaded
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

  if (embed.type === 'twitter') {
    const tweetId = url.match(/\/status\/(\d+)/)?.[1];
    return (
      <div ref={twitterRef} style={{ marginBottom: '0.5rem' }}>
        <blockquote className="twitter-tweet" data-dnt="true">
          <a href={url}>View Tweet</a>
        </blockquote>
      </div>
    );
  }

  if (embed.type === 'tiktok') {
    return (
      <div style={{ position: 'relative', paddingBottom: '177%', height: 0, maxHeight: 700, overflow: 'hidden', borderRadius: 8, marginBottom: '0.5rem' }}>
        <iframe
          src={embed.embedUrl}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none', borderRadius: 8 }}
          allowFullScreen
          allow="autoplay"
          title="TikTok video"
        />
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

  // YouTube, Twitch — standard 16:9 iframe
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
