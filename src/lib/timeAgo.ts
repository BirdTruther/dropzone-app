/**
 * timeAgo.ts — shared relative-time utility for Dropzone
 *
 * Usage:
 *   timeAgo(post.createdAt)   → "just now", "5m ago", "yesterday", "Apr 3"
 *   isoDate(post.createdAt)   → ISO 8601 string for <time dateTime="...">
 *   fullDate(post.createdAt)  → "May 10, 2026, 9:26 PM" for title/tooltip
 */

export function timeAgo(date: string | Date): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60)    return 'just now';
  if (seconds < 3600)  return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 7200)  return '1h ago';
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;

  const days = Math.floor(seconds / 86400);
  if (days === 1) return 'yesterday';
  if (days < 7)   return `${days}d ago`;
  if (days < 30)  return `${Math.floor(days / 7)}w ago`;

  // Older than ~30 days — show actual date, e.g. "Apr 3" or "Apr 3, 2024"
  const d = new Date(date);
  const thisYear = new Date().getFullYear();
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(d.getFullYear() !== thisYear && { year: 'numeric' }),
  });
}

/** Returns a full ISO 8601 string for use in <time dateTime="..."> */
export function isoDate(date: string | Date): string {
  return new Date(date).toISOString();
}

/**
 * Returns a human-readable full date string for use as a hover tooltip.
 * e.g. "May 10, 2026, 9:26 PM"
 */
export function fullDate(date: string | Date): string {
  return new Date(date).toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
