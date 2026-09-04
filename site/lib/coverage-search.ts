/**
 * Client-side keyword search across one figure's retrieved coverage.
 *
 * The media feed can run long — three sources, deduped — and a reader
 * looking for "what did the coverage say about the lawsuit" should not
 * have to scroll. This filters the list the page already holds; it makes
 * no request.
 *
 * Matching is case- and accent-insensitive and AND-combines terms: every
 * whitespace-separated term must appear somewhere in the item's title,
 * description or source. Results keep the feed's original order — recency
 * — rather than being re-ranked, so "search" narrows the feed without
 * reshuffling it.
 */

import type { MediaLink } from "./api";

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Splits a raw query into folded terms; empty when the query is blank. */
export function queryTerms(raw: string): string[] {
  return fold(raw)
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function haystack(item: MediaLink): string {
  return fold(
    [item.title, item.description ?? "", item.source, item.channel ?? ""].join(
      " ",
    ),
  );
}

/**
 * Filters `media` to items matching every term in `query`. A blank query
 * returns the list unchanged.
 */
export function searchCoverage(
  media: MediaLink[],
  query: string,
): MediaLink[] {
  const terms = queryTerms(query);
  if (terms.length === 0) return media;
  return media.filter((item) => {
    const hay = haystack(item);
    return terms.every((t) => hay.includes(t));
  });
}

/**
 * The character ranges in `text` that match any term, merged and sorted,
 * for highlighting. Ranges are half-open `[start, end)`.
 */
export function matchRanges(
  text: string,
  query: string,
): Array<[number, number]> {
  const terms = queryTerms(query);
  if (terms.length === 0) return [];
  const folded = fold(text);
  const hits: Array<[number, number]> = [];
  for (const term of terms) {
    let from = 0;
    for (;;) {
      const at = folded.indexOf(term, from);
      if (at === -1) break;
      hits.push([at, at + term.length]);
      from = at + term.length;
    }
  }
  hits.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const [start, end] of hits) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}
