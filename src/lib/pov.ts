import crypto from 'crypto';

/**
 * POV (povshare.cc) archive helpers.
 *
 * POV share pages look like https://povshare.cc/c/<id> and expire after
 * about 8 hours. The direct file for the same clip is
 * https://povshare.cc/v/<id>.mp4
 *
 * Dropzone archives a POV clip by downloading that direct file as soon as
 * the link is posted (see /api/fetch-pov), transcoding it to a standard
 * browser-playable MP4, and serving its own copy afterwards. The original
 * POV link expiring, or serving a codec/MIME type a browser rejects, no
 * longer kills the Dropzone copy.
 *
 * The cache filename is derived from the canonical /v/ URL, so posting
 * either the /c/ page link or the /v/ file link for the same clip reuses
 * the same archived file.
 */

export function isPovUrl(url: string | null): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.replace('www.', '');
    return host === 'povshare.cc';
  } catch {
    return false;
  }
}

/** Extract the clip id from a /c/<id> or /v/<id>.mp4 URL, or null. */
export function povClipId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace('www.', '');
    if (host !== 'povshare.cc') return null;
    const pageMatch = u.pathname.match(/^\/c\/([A-Za-z0-9_-]+)\/?$/);
    if (pageMatch) return pageMatch[1];
    const fileMatch = u.pathname.match(/^\/v\/([A-Za-z0-9_-]+)\.mp4$/);
    if (fileMatch) return fileMatch[1];
    return null;
  } catch {
    return null;
  }
}

/** Canonical direct-file URL for a POV clip, or null if not a POV clip URL. */
export function resolvePovDownloadUrl(url: string): string | null {
  const id = povClipId(url);
  if (!id) return null;
  return `https://povshare.cc/v/${id}.mp4`;
}

/** Local cache filename for a POV clip, or null if not a POV clip URL. */
export function povCacheFilename(url: string): string | null {
  const downloadUrl = resolvePovDownloadUrl(url);
  if (!downloadUrl) return null;
  const hash = crypto.createHash('sha256').update(downloadUrl).digest('hex').slice(0, 16);
  return `pov_${hash}.mp4`;
}
