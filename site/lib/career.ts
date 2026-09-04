/**
 * Career & Professional Intelligence, built only from data the profile
 * already carries: Wikidata "position held" / "employer" rows (dated,
 * sourced) that arrive on `entity.facts.career`, plus the profession
 * taxonomy for the industry of each role.
 *
 * Nothing here is generated. A fact with no date and no role is not
 * shown; an insight is only surfaced when the rows support it. When
 * there are no rows at all the section says so rather than inventing one.
 */

import { resolveOccupation } from "./taxonomy";

export interface CareerSource {
  name: string;
  url: string | null;
}

/** One dated step in a career, as shown on the timeline. */
export interface CareerEntry {
  start: number | null;
  end: number | null;
  role: string | null;
  organization: string | null;
  location: string | null;
  /** Industry of the role, from the taxonomy. Null when it does not map. */
  industry: string | null;
  /** True while the post is open-ended (no recorded end). */
  current: boolean;
  source: CareerSource;
}

export interface CareerInsights {
  /** Earliest recorded post, e.g. "2007 · Analyst, Firm A". */
  start: string | null;
  /** Latest open-ended post, e.g. "CEO, Firm C · since 2019". */
  current: string | null;
  /** Organisation changes with a year, e.g. "2015 · Firm A → Firm B". */
  transitions: string[];
  /** Distinct roles that read as leadership. */
  leadershipRoles: string[];
  /** True when any role names a founder. */
  founder: boolean;
  /** Role labels in chronological order (consecutive duplicates merged). */
  progression: string[];
}

export interface CareerIntelligence {
  timeline: CareerEntry[];
  organizations: string[];
  insights: CareerInsights;
  /** False when there is no sourced career data — show the empty state. */
  available: boolean;
}

type RawCareer = Record<string, unknown>;

const LEADERSHIP =
  /\b(chief|ceo|cfo|coo|cto|chair(person|man|woman)?|president|managing director|director|head of|founder|owner|partner|principal|editor-in-chief|secretary-general|prime minister)\b/i;
const FOUNDER = /\b(co[-\s]?)?founder\b|\bfounded\b/i;

function yr(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isInteger(n) && n > 1000 && n < 3000 ? n : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function label(e: CareerEntry): string {
  const who = [e.role, e.organization].filter(Boolean).join(", ");
  return who || "Role";
}

/** Build the career section model from `entity.facts`. */
export function buildCareerIntelligence(input: {
  career?: unknown;
  organizations?: unknown;
}): CareerIntelligence {
  const raw: RawCareer[] = Array.isArray(input.career)
    ? (input.career.filter(
        (r) => r && typeof r === "object",
      ) as RawCareer[])
    : [];
  const rows: CareerEntry[] = raw
    .map((r) => {
      const role = str(r.role);
      const src = (r.source ?? {}) as Record<string, unknown>;
      return {
        start: yr(r.start),
        end: yr(r.end),
        role,
        organization: str(r.organization),
        location: str(r.location),
        industry: role ? resolveOccupation(role)?.path.industry ?? null : null,
        current: yr(r.end) == null,
        source: {
          name: str(src.name) ?? "Wikidata",
          url: str(src.url),
        },
      };
    })
    .filter((r) => r.role || r.organization)
    .sort((a, b) => {
      const sa = a.start ?? a.end ?? Infinity;
      const sb = b.start ?? b.end ?? Infinity;
      return sa - sb;
    });

  const recency = (r: CareerEntry) =>
    r.current ? Infinity : r.end ?? r.start ?? 0;
  const organizations = uniq([
    ...rows
      .filter((r) => r.organization)
      .sort((a, b) => recency(b) - recency(a))
      .map((r) => r.organization as string),
    ...(Array.isArray(input.organizations)
      ? input.organizations.filter((o): o is string => typeof o === "string")
      : []),
  ]).slice(0, 8);

  const dated = rows.filter((r) => r.start != null);
  const openNow = dated.filter((r) => r.current);
  const current = openNow.length
    ? openNow.reduce((a, b) => ((b.start ?? 0) > (a.start ?? 0) ? b : a))
    : null;

  const transitions: string[] = [];
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1];
    const next = rows[i];
    if (
      prev.organization &&
      next.organization &&
      prev.organization !== next.organization &&
      next.start != null
    ) {
      transitions.push(
        `${next.start} · ${prev.organization} → ${next.organization}`,
      );
    }
  }

  const leadershipRoles = uniq(
    rows
      .map((r) => r.role)
      .filter((r): r is string => !!r && LEADERSHIP.test(r)),
  );

  const progression: string[] = [];
  for (const r of rows) {
    const l = label(r);
    if (progression[progression.length - 1] !== l) progression.push(l);
  }

  return {
    timeline: rows,
    organizations,
    insights: {
      start: dated.length ? `${dated[0].start} · ${label(dated[0])}` : null,
      current: current
        ? `${label(current)} · since ${current.start}`
        : null,
      transitions: transitions.slice(0, 6),
      leadershipRoles,
      founder: rows.some((r) => r.role && FOUNDER.test(r.role)),
      progression,
    },
    available: rows.length > 0,
  };
}

function uniq(xs: string[]): string[] {
  return [...new Set(xs)];
}
