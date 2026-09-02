/**
 * Compact relative time for coverage timestamps — "3h ago", "2d ago",
 * "just now". Deliberately coarse: an article list only needs recency at
 * a glance, and precise clock math on a static page invites hydration
 * drift, so anything past a few weeks falls back to a plain date.
 */

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export function relativeTime(iso: string, now: number = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = now - t;

  if (diff < 0) return "just now";
  if (diff < MIN) return "just now";
  if (diff < HOUR) return `${Math.floor(diff / MIN)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < 28 * DAY) return `${Math.floor(diff / DAY)}d ago`;

  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** The most recent timestamp in a list, or null if none parse. */
export function latestOf(isos: (string | undefined)[]): string | null {
  let best: string | null = null;
  let bestT = -Infinity;
  for (const iso of isos) {
    if (!iso) continue;
    const t = new Date(iso).getTime();
    if (!Number.isNaN(t) && t > bestT) {
      bestT = t;
      best = iso;
    }
  }
  return best;
}
