export type EmbedType = 'youtube' | 'tiktok' | 'spotify' | 'twitter' | 'twitch' | 'none';

export interface EmbedInfo {
  type: EmbedType;
  embedUrl?: string;
  html?: string;
}

export function getEmbed(url: string): EmbedInfo {
  try {
    const u = new URL(url);
    const host = u.hostname.replace('www.', '');

    // YouTube
    if (host === 'youtube.com' || host === 'youtu.be') {
      let videoId: string | null = null;
      if (host === 'youtu.be') {
        videoId = u.pathname.slice(1).split('?')[0];
      } else if (u.pathname === '/watch') {
        videoId = u.searchParams.get('v');
      } else if (u.pathname.startsWith('/shorts/')) {
        videoId = u.pathname.replace('/shorts/', '').split('?')[0];
      } else if (u.pathname.startsWith('/embed/')) {
        videoId = u.pathname.replace('/embed/', '').split('?')[0];
      }
      if (videoId) {
        return {
          type: 'youtube',
          embedUrl: `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`,
        };
      }
    }

    // TikTok
    if (host === 'tiktok.com' || host === 'vm.tiktok.com') {
      const match = u.pathname.match(/\/video\/(\d+)/);
      if (match) {
        return {
          type: 'tiktok',
          embedUrl: `https://www.tiktok.com/embed/v2/${match[1]}`,
        };
      }
    }

    // Spotify
    if (host === 'open.spotify.com') {
      const path = u.pathname; // e.g. /track/xxx or /playlist/xxx
      return {
        type: 'spotify',
        embedUrl: `https://open.spotify.com/embed${path}?utm_source=generator`,
      };
    }

    // Twitter / X
    if (host === 'twitter.com' || host === 'x.com') {
      const tweetMatch = u.pathname.match(/\/status\/(\d+)/);
      if (tweetMatch) {
        return {
          type: 'twitter',
          // We'll render this via Twitter's widget script
          embedUrl: url,
        };
      }
    }

    // Twitch clips
    if (host === 'twitch.tv' || host === 'clips.twitch.tv') {
      const clipMatch = u.pathname.match(/\/clip\/([\w-]+)/) || (host === 'clips.twitch.tv' && [null, u.pathname.slice(1)]);
      const clipSlug = clipMatch ? clipMatch[1] : null;
      if (clipSlug) {
        return {
          type: 'twitch',
          embedUrl: `https://clips.twitch.tv/embed?clip=${clipSlug}&parent=${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}&autoplay=false`,
        };
      }
      // Twitch live channel
      const channelMatch = u.pathname.match(/^\/([\w]+)$/);
      if (channelMatch && !u.pathname.includes('/')) {
        return {
          type: 'twitch',
          embedUrl: `https://player.twitch.tv/?channel=${channelMatch[1]}&parent=${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}&autoplay=false`,
        };
      }
    }

    return { type: 'none' };
  } catch {
    return { type: 'none' };
  }
}
