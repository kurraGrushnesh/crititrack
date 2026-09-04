/**
 * Shareable links into a specific part of a profile or comparison.
 *
 * A reader who wants to point someone at *one* controversy, or at a
 * particular comparison, should be able to copy a URL that lands there —
 * not just on the profile with a note to "scroll down". These helpers
 * build and parse the URL fragments the profile and compare pages read on
 * load.
 *
 *   profile section   /figure/?q=<name>#sentiment
 *   one controversy   /figure/?q=<name>#controversy-<anchor>
 *   one timeline day  /figure/?q=<name>#event-YYYY-MM-DD
 *   a comparison      /compare/?figures=<slug>,<slug>,<slug>
 *
 * Everything here is pure string work; the pages own the scrolling.
 */

export type ProfileSection =
  | "summary"
  | "sentiment"
  | "attention"
  | "controversies"
  | "coverage"
  | "timeline";

const SECTIONS: readonly ProfileSection[] = [
  "summary",
  "sentiment",
  "attention",
  "controversies",
  "coverage",
  "timeline",
];

/** Stable, URL-safe anchor for a controversy, from its title. */
export function controversyAnchor(title: string): string {
  return (
    "controversy-" +
    title
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60)
  );
}

/** Anchor for a timeline day (`event-2026-03-04`). */
export function eventAnchor(isoDate: string): string {
  return `event-${isoDate}`;
}

export interface ParsedHash {
  section: ProfileSection | null;
  controversyAnchor: string | null;
  eventDate: string | null;
}

/** Parses a URL fragment (with or without the leading `#`). */
export function parseProfileHash(hash: string): ParsedHash {
  const h = hash.replace(/^#/, "").trim();
  const empty: ParsedHash = {
    section: null,
    controversyAnchor: null,
    eventDate: null,
  };
  if (!h) return empty;
  if ((SECTIONS as readonly string[]).includes(h)) {
    return { ...empty, section: h as ProfileSection };
  }
  if (h.startsWith("controversy-") && h.length > "controversy-".length) {
    return { ...empty, controversyAnchor: h };
  }
  const event = h.match(/^event-(\d{4}-\d{2}-\d{2})$/);
  if (event) return { ...empty, eventDate: event[1] };
  return empty;
}

/** Builds `/figure/?q=<name>` with an optional fragment. */
export function profileLink(name: string, hash?: string): string {
  const base = `/figure/?q=${encodeURIComponent(name)}`;
  if (!hash) return base;
  return `${base}#${hash.replace(/^#/, "")}`;
}

/** Builds `/compare/?figures=a,b,c` from figure slugs (2–6 kept). */
export function comparisonLink(slugs: string[]): string {
  const clean = [...new Set(slugs.map((s) => s.trim()).filter(Boolean))].slice(
    0,
    6,
  );
  return `/compare/?figures=${clean.join(",")}`;
}

/** Parses the `figures` query value back into slugs. */
export function parseComparisonQuery(value: string | null): string[] {
  if (!value) return [];
  return [
    ...new Set(
      value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ].slice(0, 6);
}
