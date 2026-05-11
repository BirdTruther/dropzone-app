/**
 * timeAgo.ts — shared relative-time utility for Dropzone
 *
 * Rules:
 *   < 24h        → relative:   "just now", "5m ago", "3h ago"
 *   24h – 48h    → "Yesterday at 8:14 PM"
 *   2d – 7d      → "Fri at 2:31 PM"
 *   > 7d         → "May 3"  (or "May 3, 2025" if a prior year)
 *
 * Helpers:
 *   isoDate()    → ISO 8601 string for <time dateTime="...">
 *   fullDate()   → "May 10, 2026, 9:26 PM" for title/tooltip on hover
 */

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function timeAgo(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  // Under 1 hour — relative seconds/minutes
  if (seconds < 60)   return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;

  // Under 24 hours — relative hours
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;

  // 24h–48h — "Yesterday at 8:14 PM"
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameCalendarDay(then, yesterday)) {
    return `Yesterday at ${formatTime(then)}`;
  }

  // 2–7 days — "Fri at 2:31 PM"
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);
  if (then > sevenDaysAgo) {
    const weekday = then.toLocaleDateString('en-US', { weekday: 'short' });
    return `${weekday} at ${formatTime(then)}`;
  }

  // Older than 7 days — "May 3" or "May 3, 2025"
  const thisYear = now.getFullYear();
  return then.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(then.getFullYear() !== thisYear ? { year: 'numeric' } : {}),
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
