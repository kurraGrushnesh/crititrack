/**
 * The Evidence & Source Explorer — a normalised view over the sources
 * CritiTrack already retrieved for a profile: the deduped media feed,
 * the sourced controversy records, and the career record's Wikidata
 * citations. Nothing here is fetched separately; every field is derived
 * from `RealProfile`, which the figure page already holds.
 *
 * "Evidence" here means exactly what the retrieved record supports —
 * that a claim was reported, by whom, and how independently. It is
 * never a verdict on whether the claim is true, and it is kept
 * deliberately apart from sentiment (tone of coverage) and from
 * popularity (how much coverage there was): a widely-syndicated,
 * unanimous, negative story is still one independent source saying one
 * thing, not ten.
 */

import type { MediaLink, EvidenceFragment } from "./api";
import type { Controversy } from "./controversy";
import type { CareerEntry } from "./career";
import { parseSafeUrl, displayHost } from "./safe-url";

export type SourceType =
  | "news"
  | "government"
  | "wikidata"
  | "wikipedia"
  | "youtube"
  | "reddit"
  | "archive"
  | "other";

export type EvidenceStrength =
  | "strong"
  | "moderate"
  | "limited"
  | "conflicting"
  | "insufficient";

/** The record type an evidence item primarily supports. "Sentiment" is
 * not its own bucket here — a news item either supports a controversy
 * or is general coverage, and separately may or may not be one the
 * sentiment ensemble actually cited (`relatedToSentiment`). */
export type EvidenceCategory = "controversy" | "career" | "news";

export interface EvidenceItem {
  evidenceId: string;
  sourceUrl: string | null;
  sourceName: string;
  sourceType: SourceType;
  title: string;
  publicationDate: string | null;
  snippet: string | null;
  category: EvidenceCategory;
  relatedControversies: string[];
  relatedToSentiment: boolean;
  /** How many retrieved items collapsed into this one; 1 when it stood
   * alone. News items only — a controversy or career citation is a
   * single named source, not a deduped cluster. */
  duplicateCount: number | null;
  independentSourceCount: number | null;
  evidenceStrength: EvidenceStrength;
  strengthReason: string;
  /** News items only — the ensemble's per-item sentiment tag, kept
   * around just long enough to detect disagreement across sources
   * covering the same controversy. Not shown as "evidence" itself. */
  sentimentTag?: string;
}

// ── Source type ──────────────────────────────────────────────────────

const GOV_HOST = /\.(gov|mil)(\.[a-z]{2})?$/i;

export function sourceTypeFor(m: {
  url?: string | null;
  type?: string | null;
}): SourceType {
  const host = m.url ? (parseSafeUrl(m.url)?.hostname ?? "") : "";
  if (host && GOV_HOST.test(host)) return "government";
  if (host.includes("wikidata.org")) return "wikidata";
  if (host.includes("wikipedia.org")) return "wikipedia";
  if (host.includes("web.archive.org")) return "archive";
  if (m.type === "youtube") return "youtube";
  if (m.type === "reddit") return "reddit";
  if (m.type === "news" || (host && !m.type)) return "news";
  return "other";
}

const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
  news: "News",
  government: "Government / Official",
  wikidata: "Wikidata",
  wikipedia: "Wikipedia",
  youtube: "YouTube",
  reddit: "Reddit",
  archive: "Archive",
  other: "Other",
};
export { SOURCE_TYPE_LABEL };

// ── Topic overlap (for linking a media item to a controversy) ─────────

const STOPWORDS = new Set([
  "the", "a", "an", "of", "in", "on", "at", "to", "for", "and", "or",
  "is", "was", "were", "be", "been", "with", "by", "from", "as", "his",
  "her", "their", "its", "it", "that", "this", "after", "over",
]);

function significantWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOPWORDS.has(w)),
  );
}

/** Conservative: only true when the two texts share real, specific
 * words — never a guess dressed up as a relationship. */
function sharesTopic(a: string, b: string): boolean {
  const wa = significantWords(a);
  const wb = significantWords(b);
  if (wa.size < 1 || wb.size < 1) return false;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  return shared / Math.min(wa.size, wb.size) >= 0.5;
}

// ── Evidence strength ───────────────────────────────────────────────

function newsStrength(m: MediaLink): { strength: EvidenceStrength; reason: string } {
  const independent = m.independentSourceCount ?? 1;
  if (independent >= 3) {
    return { strength: "strong", reason: `${independent} independent publishers reported it` };
  }
  if (independent === 2) {
    return { strength: "moderate", reason: "2 independent publishers reported it" };
  }
  return { strength: "limited", reason: "reported by a single publisher found so far" };
}

// ── Builders ─────────────────────────────────────────────────────────

function mediaEvidence(
  media: MediaLink[],
  controversies: Controversy[],
  sentimentFragments: EvidenceFragment[],
): EvidenceItem[] {
  const linkedIds = new Set(
    sentimentFragments.map((f) => f.mediaId).filter((id): id is string => !!id),
  );

  return media.map((m) => {
    const related = controversies
      .filter((c) => sharesTopic(c.title, m.title))
      .map((c) => c.title);
    const { strength, reason } = newsStrength(m);
    return {
      evidenceId: `media-${m.id}`,
      sourceUrl: parseSafeUrl(m.url) ? m.url : null,
      sourceName: m.source || displayHost(m.url) || m.title,
      sourceType: sourceTypeFor(m),
      title: m.title,
      publicationDate: m.publishedAt ?? null,
      snippet: m.description ?? null,
      category: related.length > 0 ? "controversy" : "news",
      relatedControversies: related,
      relatedToSentiment: linkedIds.has(m.id),
      duplicateCount: m.duplicateCount ?? 1,
      independentSourceCount: m.independentSourceCount ?? 1,
      evidenceStrength: strength,
      strengthReason: reason,
      sentimentTag: m.sentimentTag,
    };
  });
}

/** A controversy's own cited sources that are not already represented
 * by a media item at the same URL (so a source is never listed twice). */
function controversyEvidence(
  controversies: Controversy[],
  media: MediaLink[],
): EvidenceItem[] {
  const mediaUrls = new Set(media.map((m) => m.url));
  const out: EvidenceItem[] = [];
  for (const c of controversies) {
    for (const [i, raw] of c.sources.entries()) {
      if (mediaUrls.has(raw)) continue;
      const url = parseSafeUrl(raw);
      out.push({
        evidenceId: `controversy-${c.title}-${i}`,
        sourceUrl: url ? raw : null,
        sourceName: url ? displayHost(raw) : raw,
        sourceType: url ? sourceTypeFor({ url: raw }) : "other",
        title: c.title,
        publicationDate: c.year != null ? `${c.year}` : null,
        snippet: c.summary || null,
        category: "controversy",
        relatedControversies: [c.title],
        relatedToSentiment: false,
        duplicateCount: null,
        independentSourceCount: null,
        evidenceStrength: url ? "moderate" : "limited",
        strengthReason: url
          ? "cited source for this controversy record"
          : "named source, no direct link on file",
      });
    }
  }
  return out;
}

function careerEvidence(entries: CareerEntry[]): EvidenceItem[] {
  return entries
    .filter((e) => e.source.url)
    .map((e, i) => ({
      evidenceId: `career-${i}-${e.start ?? "u"}`,
      sourceUrl: e.source.url,
      sourceName: e.source.name,
      sourceType: sourceTypeFor({ url: e.source.url ?? undefined }),
      title: [e.role, e.organization].filter(Boolean).join(", ") || "Career record",
      publicationDate: e.start != null ? `${e.start}` : null,
      snippet: null,
      category: "career",
      relatedControversies: [],
      relatedToSentiment: false,
      duplicateCount: null,
      independentSourceCount: null,
      evidenceStrength: "moderate",
      strengthReason: "structured Wikidata claim, not a news report",
    }));
}

/**
 * Marks a news item's evidence as "conflicting" when the coverage it
 * belongs to is genuinely split — the controversy it relates to has
 * other linked sources tagged with the opposite sentiment. A real,
 * observable signal (different outlets characterised the same episode
 * differently), never an assertion about which side is right; the
 * disagreeing items are returned alongside so a UI can list "Source A /
 * Source B" rather than just a label.
 */
function flagConflicts(items: EvidenceItem[]): EvidenceItem[] {
  const byControversy = new Map<string, EvidenceItem[]>();
  for (const e of items) {
    for (const title of e.relatedControversies) {
      const list = byControversy.get(title) ?? [];
      list.push(e);
      byControversy.set(title, list);
    }
  }

  const conflictedControversies = new Set<string>();
  for (const [title, list] of byControversy) {
    const tags = new Set(list.map((e) => e.sentimentTag).filter(Boolean));
    if (tags.has("positive") && tags.has("negative")) {
      conflictedControversies.add(title);
    }
  }
  if (conflictedControversies.size === 0) return items;

  return items.map((e) => {
    const conflicted = e.relatedControversies.some((t) => conflictedControversies.has(t));
    if (!conflicted || !e.sentimentTag) return e;
    return {
      ...e,
      evidenceStrength: "conflicting" as const,
      strengthReason: "coverage of this episode is not unanimous — see the other linked sources",
    };
  });
}

/** The controversy titles {@link flagConflicts} found split coverage
 * for, for a UI that wants to call the disagreement out explicitly. */
export function conflictingControversies(items: EvidenceItem[]): string[] {
  const byControversy = new Map<string, Set<string | undefined>>();
  for (const e of items) {
    for (const title of e.relatedControversies) {
      const tags = byControversy.get(title) ?? new Set<string | undefined>();
      if (e.sentimentTag) tags.add(e.sentimentTag);
      byControversy.set(title, tags);
    }
  }
  return [...byControversy.entries()]
    .filter(([, tags]) => tags.has("positive") && tags.has("negative"))
    .map(([title]) => title);
}

/**
 * The unified, deduplicated evidence list for a profile. Every item
 * traces to something already retrieved — no separate fetch, no new
 * collection.
 */
/** Evidence items for one controversy, by title. Empty means exactly
 * that — no supporting source was retrieved for it — never padded. */
export function evidenceForControversy(
  items: EvidenceItem[],
  title: string,
): EvidenceItem[] {
  return items.filter((e) => e.relatedControversies.includes(title));
}

export function buildEvidenceItems(input: {
  media: MediaLink[];
  controversies: Controversy[];
  career: CareerEntry[];
  sentimentEvidence: EvidenceFragment[];
}): EvidenceItem[] {
  const news = mediaEvidence(input.media, input.controversies, input.sentimentEvidence);
  return [
    ...flagConflicts(news),
    ...controversyEvidence(input.controversies, input.media),
    ...careerEvidence(input.career),
  ];
}
