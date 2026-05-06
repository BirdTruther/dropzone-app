export type EmbedType = 'youtube' | 'tiktok' | 'spotify' | 'twitter' | 'twitch' | 'facebook' | 'none';

export interface EmbedInfo {
  type: EmbedType;
  embedUrl?: string;
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
      return {
        type: 'spotify',
        embedUrl: `https://open.spotify.com/embed${u.pathname}?utm_source=generator`,
      };
    }

    // Twitter / X
    if (host === 'twitter.com' || host === 'x.com') {
      if (u.pathname.match(/\/status\/\d+/)) {
        return { type: 'twitter', embedUrl: url };
      }
    }

    // Twitch
    if (host === 'twitch.tv' || host === 'clips.twitch.tv') {
      const clipMatch = u.pathname.match(/\/clip\/([\w-]+)/) ||
        (host === 'clips.twitch.tv' ? [null, u.pathname.slice(1)] : null);
      if (clipMatch) {
        return {
          type: 'twitch',
          embedUrl: `https://clips.twitch.tv/embed?clip=${clipMatch[1]}&parent=${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}&autoplay=false`,
        };
      }
      const channelMatch = u.pathname.match(/^\/([\w]+)$/);
      if (channelMatch) {
        return {
          type: 'twitch',
          embedUrl: `https://player.twitch.tv/?channel=${channelMatch[1]}&parent=${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}&autoplay=false`,
        };
      }
    }

    // Facebook videos
    // Handles: facebook.com/watch?v=ID, facebook.com/*/videos/ID, fb.watch/slug
    if (host === 'facebook.com' || host === 'fb.watch' || host === 'm.facebook.com') {
      const isVideo =
        u.searchParams.has('v') ||
        u.pathname.includes('/videos/') ||
        u.pathname.includes('/video/') ||
        host === 'fb.watch';
      if (isVideo) {
        const encodedUrl = encodeURIComponent(url);
        return {
          type: 'facebook',
          embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodedUrl}&show_text=false&width=560&autoplay=false`,
        };
      }
    }

    return { type: 'none' };
  } catch {
    return { type: 'none' };
  }
}
