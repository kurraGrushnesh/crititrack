/**
 * Pure watchlist logic — parsing, membership, toggling. The React store
 * that wires this to localStorage lives in
 * `components/watchlist-store.ts`; this file is what the tests exercise.
 *
 * Step 17 (Watch Intelligence) extends the entry with what a watch needs
 * to track for itself — what the reader has already seen, and what they
 * want emphasised — without changing where or how the watchlist is
 * stored. `slug` remains the stable identity (the same key the profile,
 * cache and evidence pipeline already use); nothing here is keyed by
 * display name.
 */

/** What kinds of ChangeEvent a reader wants surfaced. All true by
 * default — this narrows presentation/ordering, it never invents or
 * suppresses an actual detected change. */
export interface NotificationPreferences {
  careerChanges: boolean;
  organizationChanges: boolean;
  controversyChanges: boolean;
  claimChanges: boolean;
  sentimentChanges: boolean;
  attentionChanges: boolean;
  critiScoreChanges: boolean;
  profileChanges: boolean;
  sourceCoverageChanges: boolean;
  newsEvents: boolean;
  /** When true, the feed defaults to MAJOR + SIGNIFICANT only. */
  importantOnly: boolean;
}

export function defaultNotificationPreferences(): NotificationPreferences {
  return {
    careerChanges: true,
    organizationChanges: true,
    controversyChanges: true,
    claimChanges: true,
    sentimentChanges: true,
    attentionChanges: true,
    critiScoreChanges: true,
    profileChanges: true,
    sourceCoverageChanges: true,
    newsEvents: true,
    importantOnly: true,
  };
}

function normalizeNotificationPreferences(raw: unknown): NotificationPreferences {
  const d = defaultNotificationPreferences();
  if (!raw || typeof raw !== "object") return d;
  const r = raw as Partial<NotificationPreferences>;
  const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
  return {
    careerChanges: bool(r.careerChanges, d.careerChanges),
    organizationChanges: bool(r.organizationChanges, d.organizationChanges),
    controversyChanges: bool(r.controversyChanges, d.controversyChanges),
    claimChanges: bool(r.claimChanges, d.claimChanges),
    sentimentChanges: bool(r.sentimentChanges, d.sentimentChanges),
    attentionChanges: bool(r.attentionChanges, d.attentionChanges),
    critiScoreChanges: bool(r.critiScoreChanges, d.critiScoreChanges),
    profileChanges: bool(r.profileChanges, d.profileChanges),
    sourceCoverageChanges: bool(r.sourceCoverageChanges, d.sourceCoverageChanges),
    newsEvents: bool(r.newsEvents, d.newsEvents),
    importantOnly: bool(r.importantOnly, d.importantOnly),
  };
}

export type MinimumSeverity = "ALL" | "MAJOR" | "SIGNIFICANT" | "MINOR" | "INFO";
export type MinimumConfidence = "ALL" | "HIGH" | "MEDIUM" | "LOW";
export type WatchTimeRange = "24h" | "7d" | "30d" | "90d" | "all";

export interface WatchFilters {
  minimumSeverity: MinimumSeverity;
  minimumConfidence: MinimumConfidence;
  timeRange: WatchTimeRange;
}

export function defaultWatchFilters(): WatchFilters {
  return { minimumSeverity: "ALL", minimumConfidence: "ALL", timeRange: "all" };
}

function normalizeWatchFilters(raw: unknown): WatchFilters {
  const d = defaultWatchFilters();
  if (!raw || typeof raw !== "object") return d;
  const r = raw as Partial<WatchFilters>;
  const severities: MinimumSeverity[] = ["ALL", "MAJOR", "SIGNIFICANT", "MINOR", "INFO"];
  const confidences: MinimumConfidence[] = ["ALL", "HIGH", "MEDIUM", "LOW"];
  const ranges: WatchTimeRange[] = ["24h", "7d", "30d", "90d", "all"];
  return {
    minimumSeverity: severities.includes(r.minimumSeverity as MinimumSeverity)
      ? (r.minimumSeverity as MinimumSeverity)
      : d.minimumSeverity,
    minimumConfidence: confidences.includes(r.minimumConfidence as MinimumConfidence)
      ? (r.minimumConfidence as MinimumConfidence)
      : d.minimumConfidence,
    timeRange: ranges.includes(r.timeRange as WatchTimeRange) ? (r.timeRange as WatchTimeRange) : d.timeRange,
  };
}

export interface WatchEntry {
  slug: string;
  name: string;
  /**
   * Optional folder-like tags ("Politicians", "Watching closely"). Absent
   * on entries saved before tagging shipped; always present after a parse.
   */
  tags: string[];
  /** Wikidata id, when known — the truer stable identity behind `slug`,
   * kept alongside it rather than replacing it (older entries predate
   * this field). */
  wikidataId?: string;
  /** Epoch ms of the last time the reader opened this watch's
   * intelligence view. Null until they ever have. */
  lastViewedAt: number | null;
  /** Epoch ms up to which the reader has "seen" detected changes —
   * anything detected after this is unseen. Null means everything ever
   * detected is unseen (a fresh watch). */
  lastSeenChangeAt: number | null;
  notificationPreferences: NotificationPreferences;
  filters: WatchFilters;
}

/** Trims, dedupes and sorts a raw tag list. */
export function normalizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  for (const t of raw) {
    if (typeof t !== "string") continue;
    const clean = t.trim();
    if (clean) seen.add(clean);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

/**
 * Parses stored JSON into entries, migrating the old bare-slug-array
 * format (`["taylor-swift"]`) to `{ slug, name, tags }`. Malformed
 * entries are dropped rather than rendered.
 */
export function parseWatchlist(raw: string | null): WatchEntry[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((v): WatchEntry | null => {
      if (typeof v === "string") return newWatchEntry(v, v);
      if (
        v &&
        typeof v === "object" &&
        typeof (v as WatchEntry).slug === "string"
      ) {
        const e = v as Partial<WatchEntry> & { slug: string };
        return {
          slug: e.slug,
          name: typeof e.name === "string" && e.name ? e.name : e.slug,
          tags: normalizeTags(e.tags),
          wikidataId: typeof e.wikidataId === "string" && e.wikidataId ? e.wikidataId : undefined,
          lastViewedAt: typeof e.lastViewedAt === "number" ? e.lastViewedAt : null,
          lastSeenChangeAt: typeof e.lastSeenChangeAt === "number" ? e.lastSeenChangeAt : null,
          notificationPreferences: normalizeNotificationPreferences(e.notificationPreferences),
          filters: normalizeWatchFilters(e.filters),
        };
      }
      return null;
    })
    .filter((e): e is WatchEntry => e !== null);
}

function newWatchEntry(slug: string, name: string, wikidataId?: string): WatchEntry {
  return {
    slug,
    name,
    tags: [],
    wikidataId,
    lastViewedAt: null,
    lastSeenChangeAt: null,
    notificationPreferences: defaultNotificationPreferences(),
    filters: defaultWatchFilters(),
  };
}

/** Every tag in use across the list, sorted. */
export function allTags(list: WatchEntry[]): string[] {
  return normalizeTags(list.flatMap((e) => e.tags));
}

/** The entries carrying `tag`; `null` tag means "untagged". */
export function entriesForTag(
  list: WatchEntry[],
  tag: string | null,
): WatchEntry[] {
  if (tag === null) return list.filter((e) => e.tags.length === 0);
  return list.filter((e) => e.tags.includes(tag));
}

/** Adds `tag` to one entry (no-op if absent or already tagged). */
export function addTag(
  list: WatchEntry[],
  slug: string,
  tag: string,
): WatchEntry[] {
  const clean = tag.trim();
  if (!clean) return list;
  return list.map((e) =>
    e.slug === slug && !e.tags.includes(clean)
      ? { ...e, tags: normalizeTags([...e.tags, clean]) }
      : e,
  );
}

/** Removes `tag` from one entry, or from all entries when `slug` is null. */
export function removeTag(
  list: WatchEntry[],
  slug: string | null,
  tag: string,
): WatchEntry[] {
  return list.map((e) =>
    (slug === null || e.slug === slug) && e.tags.includes(tag)
      ? { ...e, tags: e.tags.filter((t) => t !== tag) }
      : e,
  );
}

/** Renames a tag everywhere it appears. */
export function renameTag(
  list: WatchEntry[],
  from: string,
  to: string,
): WatchEntry[] {
  const target = to.trim();
  if (!target) return list;
  return list.map((e) =>
    e.tags.includes(from)
      ? { ...e, tags: normalizeTags(e.tags.map((t) => (t === from ? target : t))) }
      : e,
  );
}

export function isWatched(list: WatchEntry[], slug: string): boolean {
  return list.some((e) => e.slug === slug);
}

/**
 * The list with `slug` added if absent, removed if present. Watching
 * works identically for a catalogue figure or a person found purely
 * through global search/entity resolution — this never checks
 * catalogue membership, only that a resolved `slug` and `name` exist.
 */
export function toggledWatchlist(
  list: WatchEntry[],
  slug: string,
  name: string,
  wikidataId?: string,
): WatchEntry[] {
  return isWatched(list, slug)
    ? list.filter((e) => e.slug !== slug)
    : [...list, newWatchEntry(slug, name, wikidataId)];
}

/** Records that the reader opened this watch's intelligence view now. */
export function markViewed(list: WatchEntry[], slug: string, at: number): WatchEntry[] {
  return list.map((e) => (e.slug === slug ? { ...e, lastViewedAt: at } : e));
}

/** Advances the "seen changes" cursor — call only when the reader has
 * actually reviewed the changes up to `at`, never merely because a page
 * rendered. */
export function markChangesSeen(list: WatchEntry[], slug: string, at: number): WatchEntry[] {
  return list.map((e) => (e.slug === slug ? { ...e, lastSeenChangeAt: at } : e));
}

export function setNotificationPreferences(
  list: WatchEntry[],
  slug: string,
  prefs: NotificationPreferences,
): WatchEntry[] {
  return list.map((e) => (e.slug === slug ? { ...e, notificationPreferences: prefs } : e));
}

export function setWatchFilters(list: WatchEntry[], slug: string, filters: WatchFilters): WatchEntry[] {
  return list.map((e) => (e.slug === slug ? { ...e, filters } : e));
}
