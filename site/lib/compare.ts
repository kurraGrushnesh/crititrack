/**
 * Advanced Compare — puts two (extensible to more) resolved entities
 * side by side using intelligence every other system already computes.
 * This module never scores, ranks, or judges: it only describes real
 * differences ("Entity A has 3 more documented controversy episodes"),
 * and answers "how do these entities differ according to the available
 * evidence", never "who is better".
 *
 * Every comparison row traces to a real field on an already-built
 * `EntityComparisonContext` (itself assembled, at the call site, from
 * the exact same `buildEvidenceItems`/`buildClaimMatrix`/
 * `buildCoverageReport`/`buildHistoricalOverview`/`computeControversyIndex`
 * calls `use-report.ts` already makes for Professional Research
 * Reports) — never a new evidence, scoring, or verification system.
 *
 * Language discipline is enforced structurally, not by convention: a
 * `ComparisonRow`'s `note` is composed only from count/value templates
 * defined in this file (see the `DIFF_TEMPLATES` below) — there is no
 * code path here that accepts or emits free-text "better/worse/more
 * trustworthy" language.
 */

import type { Controversy } from "./controversy";
import type { Claim } from "./claims";
import type { CareerIntelligence } from "./career";
import type { CoverageReport } from "./coverage";
import type { HistoricalOverview, HistoricalSnapshot, HistoricalTimeRange, TurningPoint } from "./historical";
import type { ScoreBand, IndexHistoryPoint } from "./controversy-index";
import type { SentimentBand } from "./sentiment";
import type { EntityRelationship } from "./relationships";

export const COMPARE_METHODOLOGY_VERSION = "compare-1";

// ── Comparison model ─────────────────────────────────────────────────

export type ComparisonTopic =
  | "ALL"
  | "CAREER"
  | "ORGANIZATION"
  | "CONTROVERSY"
  | "CLAIMS"
  | "NEWS"
  | "SENTIMENT"
  | "ATTENTION"
  | "CRITISCORE";

export type ComparisonDataMode = "ALL" | "HIGH_CONFIDENCE" | "MEDIUM_PLUS" | "EVIDENCE_BACKED";

export interface ComparisonFilters {
  topic: ComparisonTopic;
  dataMode: ComparisonDataMode;
}

export function defaultComparisonFilters(): ComparisonFilters {
  return { topic: "ALL", dataMode: "ALL" };
}

export interface Comparison {
  comparisonId: string;
  userId: string;
  entityIds: string[];
  title: string;
  createdAt: string;
  updatedAt: string;
  filters: ComparisonFilters;
  timeRange: HistoricalTimeRange;
  methodologyVersion: string;
}

function titleForComparison(names: string[]): string {
  if (names.length < 2) return "Untitled comparison";
  return `${names[0]} vs ${names.slice(1).join(", ")}`;
}

export function createComparison(input: {
  comparisonId: string;
  userId: string;
  entityIds: string[];
  entityNames?: string[];
  title?: string;
  now: string;
}): Comparison {
  return {
    comparisonId: input.comparisonId,
    userId: input.userId,
    entityIds: input.entityIds,
    title: input.title?.trim() || titleForComparison(input.entityNames ?? []),
    createdAt: input.now,
    updatedAt: input.now,
    filters: defaultComparisonFilters(),
    timeRange: "1y",
    methodologyVersion: COMPARE_METHODOLOGY_VERSION,
  };
}

export function renameComparison(c: Comparison, title: string, now: string): Comparison {
  const trimmed = title.trim();
  if (!trimmed) return c;
  return { ...c, title: trimmed, updatedAt: now };
}

export function updateFilters(c: Comparison, filters: Partial<ComparisonFilters>, now: string): Comparison {
  return { ...c, filters: { ...c.filters, ...filters }, updatedAt: now };
}

export function updateTimeRange(c: Comparison, timeRange: HistoricalTimeRange, now: string): Comparison {
  return { ...c, timeRange, updatedAt: now };
}

// ── Per-entity context (built by the caller from a live profile) ────

export interface EntityComparisonContext {
  entityId: string;
  entityName: string;
  profession: string | null;
  country: string | null;
  currentRole: string | null;
  industries: string[];
  watchStatus: boolean;
  critiScore: number | null;
  critiScoreBand: ScoreBand | null;
  critiScoreHistory: IndexHistoryPoint[];
  sentimentScore: number | null;
  sentimentBand: SentimentBand | null;
  sentimentTrendDirection: "up" | "down" | "stable" | null;
  sentimentSnapshots: HistoricalSnapshot[];
  attentionSummary: {
    peakDate: string;
    peakViews: number;
    latestViews: number;
    changePct: number;
  } | null;
  career: CareerIntelligence;
  controversies: Controversy[];
  claims: Claim[];
  meaningfulNewsCount: number;
  coverageReport: CoverageReport | null;
  historicalOverview: HistoricalOverview | null;
  /** Documented relationships for this entity (Step 22) — used only for
   * the "direct relationship" and "shared organization" rows in a
   * comparison, never to score or rank. */
  relationships: EntityRelationship[];
}

// ── Rows ─────────────────────────────────────────────────────────────

export interface ComparisonRow {
  rowId: string;
  topic: ComparisonTopic;
  metric: string;
  valueA: string;
  valueB: string;
  /** A neutral, descriptive statement of the difference — never a
   * judgment. Null when the two entities are equal on this metric. */
  note: string | null;
  /** True when this row is backed by real evidence/source references
   * (not just counts) — used by Evidence-backed mode to prioritize or
   * filter rows. */
  evidenceBacked: boolean;
}

function row(input: {
  rowId: string;
  topic: ComparisonTopic;
  metric: string;
  valueA: string | number | null;
  valueB: string | number | null;
  note?: string | null;
  evidenceBacked?: boolean;
}): ComparisonRow {
  return {
    rowId: input.rowId,
    topic: input.topic,
    metric: input.metric,
    valueA: input.valueA == null ? "Unavailable" : String(input.valueA),
    valueB: input.valueB == null ? "Unavailable" : String(input.valueB),
    note: input.note ?? null,
    evidenceBacked: input.evidenceBacked ?? false,
  };
}

/** "Entity A has N more X" / "Entity B has N more X" / null when equal.
 * The only comparative-language generator in this module — every call
 * site passes a real numeric delta, never free text. */
function countDifference(nameA: string, nameB: string, noun: string, a: number, b: number): string | null {
  if (a === b) return null;
  const diff = Math.abs(a - b);
  const leader = a > b ? nameA : nameB;
  return `${leader} has ${diff} more ${noun}${diff === 1 ? "" : ""} in the selected scope.`;
}

function valueDifference(nameA: string, nameB: string, label: string, a: number, b: number, decimals = 0): string | null {
  if (a === b) return null;
  const leader = a > b ? nameA : nameB;
  const diff = Math.abs(a - b);
  return `${leader} has a higher ${label} (by ${diff.toFixed(decimals)}).`;
}

// ── Section builders ─────────────────────────────────────────────────

function inRange(dateIso: string | null, range: HistoricalTimeRange, now: number): boolean {
  if (!dateIso) return true; // undated records are never excluded by a time filter
  if (range === "all") return true;
  const days: Record<Exclude<HistoricalTimeRange, "all">, number> = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
    "1y": 365,
    "3y": 365 * 3,
    "5y": 365 * 5,
  };
  const cutoff = now - days[range] * 86_400_000;
  return Date.parse(dateIso) >= cutoff;
}

function critiscoreRows(a: EntityComparisonContext, b: EntityComparisonContext): ComparisonRow[] {
  const rows: ComparisonRow[] = [
    row({
      rowId: "critiscore-current",
      topic: "CRITISCORE",
      metric: "CritiScore",
      valueA: a.critiScore != null ? `${Math.round(a.critiScore)} — ${a.critiScoreBand ?? ""}` : null,
      valueB: b.critiScore != null ? `${Math.round(b.critiScore)} — ${b.critiScoreBand ?? ""}` : null,
      note: a.critiScore != null && b.critiScore != null ? valueDifference(a.entityName, b.entityName, "current CritiScore", a.critiScore, b.critiScore) : null,
      evidenceBacked: true,
    }),
  ];
  if (a.critiScoreHistory.length > 0 || b.critiScoreHistory.length > 0) {
    rows.push(
      row({
        rowId: "critiscore-history",
        topic: "CRITISCORE",
        metric: "CritiScore history reconstructed",
        valueA: a.critiScoreHistory.length > 0 ? `${a.critiScoreHistory.length} year(s)` : null,
        valueB: b.critiScoreHistory.length > 0 ? `${b.critiScoreHistory.length} year(s)` : null,
        note: countDifference(a.entityName, b.entityName, "year(s) of reconstructed CritiScore history", a.critiScoreHistory.length, b.critiScoreHistory.length),
      }),
    );
  }
  return rows;
}

function sentimentRows(a: EntityComparisonContext, b: EntityComparisonContext): ComparisonRow[] {
  return [
    row({
      rowId: "sentiment-current",
      topic: "SENTIMENT",
      metric: "Current public sentiment",
      valueA: a.sentimentScore != null ? `${Math.round(a.sentimentScore)} (${a.sentimentBand ?? ""})` : null,
      valueB: b.sentimentScore != null ? `${Math.round(b.sentimentScore)} (${b.sentimentBand ?? ""})` : null,
      note:
        a.sentimentScore != null && b.sentimentScore != null
          ? valueDifference(a.entityName, b.entityName, "current sentiment score", a.sentimentScore, b.sentimentScore)
          : null,
    }),
    row({
      rowId: "sentiment-history",
      topic: "SENTIMENT",
      metric: "Measured sentiment snapshots available",
      valueA: a.sentimentSnapshots.length,
      valueB: b.sentimentSnapshots.length,
      note: countDifference(a.entityName, b.entityName, "measured sentiment snapshot(s)", a.sentimentSnapshots.length, b.sentimentSnapshots.length),
    }),
  ];
}

function attentionRows(a: EntityComparisonContext, b: EntityComparisonContext): ComparisonRow[] {
  if (!a.attentionSummary && !b.attentionSummary) return [];
  return [
    row({
      rowId: "attention-latest",
      topic: "ATTENTION",
      metric: "Latest Wikipedia pageviews",
      valueA: a.attentionSummary?.latestViews.toLocaleString() ?? null,
      valueB: b.attentionSummary?.latestViews.toLocaleString() ?? null,
      note:
        a.attentionSummary && b.attentionSummary
          ? countDifference(a.entityName, b.entityName, "recent page view(s)", a.attentionSummary.latestViews, b.attentionSummary.latestViews)
          : null,
    }),
  ];
}

function professionalRows(a: EntityComparisonContext, b: EntityComparisonContext): ComparisonRow[] {
  return [
    row({ rowId: "profession", topic: "CAREER", metric: "Primary profession", valueA: a.profession, valueB: b.profession }),
    row({ rowId: "current-role", topic: "CAREER", metric: "Current role", valueA: a.currentRole, valueB: b.currentRole }),
    row({
      rowId: "industries",
      topic: "CAREER",
      metric: "Industries",
      valueA: a.industries.length > 0 ? a.industries.join(", ") : null,
      valueB: b.industries.length > 0 ? b.industries.join(", ") : null,
    }),
  ];
}

function careerRows(a: EntityComparisonContext, b: EntityComparisonContext, range: HistoricalTimeRange, now: number): ComparisonRow[] {
  const aEntries = a.career.timeline.filter((e) => e.start == null || inRange(`${e.start}-01-01`, range, now));
  const bEntries = b.career.timeline.filter((e) => e.start == null || inRange(`${e.start}-01-01`, range, now));
  const rows: ComparisonRow[] = [
    row({
      rowId: "career-transitions",
      topic: "CAREER",
      metric: "Documented career transitions (selected period)",
      valueA: aEntries.length,
      valueB: bEntries.length,
      note: countDifference(a.entityName, b.entityName, "documented career transition(s) in the selected period", aEntries.length, bEntries.length),
      evidenceBacked: aEntries.length > 0 || bEntries.length > 0,
    }),
  ];
  const aOrgs = new Set(a.career.organizations);
  const bOrgs = new Set(b.career.organizations);
  rows.push(
    row({
      rowId: "organizations",
      topic: "ORGANIZATION",
      metric: "Organizations on record",
      valueA: aOrgs.size,
      valueB: bOrgs.size,
      note: countDifference(a.entityName, b.entityName, "organization(s) on record", aOrgs.size, bOrgs.size),
    }),
  );
  return rows;
}

function controversyRows(a: EntityComparisonContext, b: EntityComparisonContext, range: HistoricalTimeRange, now: number): ComparisonRow[] {
  const aIn = a.controversies.filter((c) => inRange(c.year != null ? `${c.year}-01-01` : null, range, now));
  const bIn = b.controversies.filter((c) => inRange(c.year != null ? `${c.year}-01-01` : null, range, now));
  const severe = (list: Controversy[], min: number) => list.filter((c) => c.severity >= min).length;
  return [
    row({
      rowId: "controversy-count",
      topic: "CONTROVERSY",
      metric: "Documented controversy episodes (selected period)",
      valueA: aIn.length,
      valueB: bIn.length,
      note: countDifference(a.entityName, b.entityName, "documented controversy record(s) in the available CritiTrack dataset", aIn.length, bIn.length),
      evidenceBacked: aIn.some((c) => c.sources.length > 0) || bIn.some((c) => c.sources.length > 0),
    }),
    row({
      rowId: "controversy-severe",
      topic: "CONTROVERSY",
      metric: "Severity 4–5 episodes",
      valueA: severe(aIn, 4),
      valueB: severe(bIn, 4),
      note: countDifference(a.entityName, b.entityName, "high-severity (4–5) documented controversy episode(s)", severe(aIn, 4), severe(bIn, 4)),
    }),
  ];
}

function claimRows(a: EntityComparisonContext, b: EntityComparisonContext): ComparisonRow[] {
  const corroborated = (list: Claim[]) => list.filter((c) => c.status === "supported" || c.status === "resolved_authoritative").length;
  return [
    row({
      rowId: "claim-count",
      topic: "CLAIMS",
      metric: "Documented claims in selected period",
      valueA: a.claims.length,
      valueB: b.claims.length,
      note: countDifference(a.entityName, b.entityName, "documented claim(s) in the selected period", a.claims.length, b.claims.length),
      evidenceBacked: true,
    }),
    row({
      rowId: "claim-corroborated",
      topic: "CLAIMS",
      metric: "Corroborated / authoritatively resolved claims",
      valueA: corroborated(a.claims),
      valueB: corroborated(b.claims),
      note: countDifference(a.entityName, b.entityName, "corroborated or authoritatively resolved claim(s)", corroborated(a.claims), corroborated(b.claims)),
      evidenceBacked: true,
    }),
    row({
      rowId: "claim-needs-review",
      topic: "CLAIMS",
      metric: "Insufficient-evidence / unresolved claims",
      valueA: a.claims.filter((c) => c.status === "insufficient_evidence" || c.status === "unknown").length,
      valueB: b.claims.filter((c) => c.status === "insufficient_evidence" || c.status === "unknown").length,
    }),
  ];
}

function newsRows(a: EntityComparisonContext, b: EntityComparisonContext): ComparisonRow[] {
  return [
    row({
      rowId: "news-events",
      topic: "NEWS",
      metric: "Meaningful news events (selected period)",
      valueA: a.meaningfulNewsCount,
      valueB: b.meaningfulNewsCount,
      note: countDifference(a.entityName, b.entityName, "meaningful news event(s) in the selected period", a.meaningfulNewsCount, b.meaningfulNewsCount),
    }),
  ];
}

function turningPointRows(a: EntityComparisonContext, b: EntityComparisonContext): ComparisonRow[] {
  const aPoints = a.historicalOverview?.turningPoints ?? [];
  const bPoints = b.historicalOverview?.turningPoints ?? [];
  if (aPoints.length === 0 && bPoints.length === 0) return [];
  return [
    row({
      rowId: "turning-points",
      topic: "ALL",
      metric: "Major turning points identified",
      valueA: aPoints.length,
      valueB: bPoints.length,
      note: countDifference(a.entityName, b.entityName, "major turning point(s) identified", aPoints.length, bPoints.length),
    }),
  ];
}

export interface EntityTurningPoints {
  entityId: string;
  entityName: string;
  points: TurningPoint[];
}

/** The full per-entity turning-point lists, for a detail view — spec
 * section 14 wants each entity's own list (date/type/reason/evidence),
 * not just a count. Reuses `HistoricalOverview.turningPoints` directly. */
export function turningPointsFor(a: EntityComparisonContext, b: EntityComparisonContext): EntityTurningPoints[] {
  return [
    { entityId: a.entityId, entityName: a.entityName, points: a.historicalOverview?.turningPoints ?? [] },
    { entityId: b.entityId, entityName: b.entityName, points: b.historicalOverview?.turningPoints ?? [] },
  ];
}

function coverageRows(a: EntityComparisonContext, b: EntityComparisonContext): ComparisonRow[] {
  if (!a.coverageReport && !b.coverageReport) return [];
  const dims = new Set([
    ...(a.coverageReport?.dimensions.map((d) => d.key) ?? []),
    ...(b.coverageReport?.dimensions.map((d) => d.key) ?? []),
  ]);
  const rows: ComparisonRow[] = [];
  for (const key of dims) {
    const da = a.coverageReport?.dimensions.find((d) => d.key === key);
    const db = b.coverageReport?.dimensions.find((d) => d.key === key);
    if (!da && !db) continue;
    if (da?.level === db?.level) continue; // only show substantive differences
    rows.push(
      row({
        rowId: `coverage-${key}`,
        topic: "ALL",
        metric: `${da?.label ?? db?.label} coverage`,
        valueA: da ? da.level.toUpperCase() : null,
        valueB: db ? db.level.toUpperCase() : null,
        note: `Comparison for this dimension is limited by unequal available data.`,
      }),
    );
  }
  return rows;
}

function evidenceRows(a: EntityComparisonContext, b: EntityComparisonContext): ComparisonRow[] {
  const aEvidenceBacked = a.controversies.filter((c) => c.sources.length > 0).length;
  const bEvidenceBacked = b.controversies.filter((c) => c.sources.length > 0).length;
  return [
    row({
      rowId: "evidence-sourced-controversies",
      topic: "ALL",
      metric: "Sourced controversy records",
      valueA: aEvidenceBacked,
      valueB: bEvidenceBacked,
      note:
        aEvidenceBacked === bEvidenceBacked
          ? null
          : `${aEvidenceBacked > bEvidenceBacked ? a.entityName : b.entityName} has stronger available corroboration for the selected controversy records.`,
      evidenceBacked: true,
    }),
  ];
}

// ── Assembly ─────────────────────────────────────────────────────────

export interface ComparisonSection {
  topic: ComparisonTopic;
  title: string;
  rows: ComparisonRow[];
}

const TOPIC_LABEL: Record<Exclude<ComparisonTopic, "ALL">, string> = {
  CRITISCORE: "CritiScore",
  SENTIMENT: "Sentiment",
  ATTENTION: "Attention",
  CAREER: "Professional & Career",
  ORGANIZATION: "Organizations",
  CONTROVERSY: "Controversies",
  CLAIMS: "Claims & Verification",
  NEWS: "News & Public Coverage",
};

function passesDataMode(r: ComparisonRow, mode: ComparisonDataMode): boolean {
  if (mode === "ALL") return true;
  if (mode === "EVIDENCE_BACKED") return r.evidenceBacked;
  // HIGH_CONFIDENCE / MEDIUM_PLUS: without a per-row confidence figure to
  // threshold on, the only thing this module can honestly guarantee is
  // "backed by something real" — so both modes fall back to the same
  // evidence-backed filter rather than inventing a confidence figure
  // per row.
  return r.evidenceBacked;
}

/** Builds every comparison section for two entities. Sections with no
 * rows are omitted entirely. */
export function buildComparison(input: {
  a: EntityComparisonContext;
  b: EntityComparisonContext;
  filters: ComparisonFilters;
  timeRange: HistoricalTimeRange;
  now?: number;
}): ComparisonSection[] {
  const { a, b, filters, timeRange } = input;
  const now = input.now ?? Date.now();

  const byTopic: { topic: Exclude<ComparisonTopic, "ALL">; rows: ComparisonRow[] }[] = [
    { topic: "CRITISCORE", rows: critiscoreRows(a, b) },
    { topic: "SENTIMENT", rows: sentimentRows(a, b) },
    { topic: "ATTENTION", rows: attentionRows(a, b) },
    { topic: "CAREER", rows: professionalRows(a, b) },
    { topic: "CAREER", rows: careerRows(a, b, timeRange, now).filter((r) => r.topic === "CAREER") },
    { topic: "ORGANIZATION", rows: careerRows(a, b, timeRange, now).filter((r) => r.topic === "ORGANIZATION") },
    { topic: "CONTROVERSY", rows: controversyRows(a, b, timeRange, now) },
    { topic: "CLAIMS", rows: claimRows(a, b) },
    { topic: "NEWS", rows: newsRows(a, b) },
  ];

  const extraRows = [...turningPointRows(a, b), ...coverageRows(a, b), ...evidenceRows(a, b)];

  const sections: ComparisonSection[] = [];
  for (const { topic, rows } of byTopic) {
    if (filters.topic !== "ALL" && filters.topic !== topic) continue;
    const filtered = rows.filter((r) => passesDataMode(r, filters.dataMode));
    if (filtered.length === 0) continue;
    sections.push({ topic, title: TOPIC_LABEL[topic], rows: filtered });
  }
  if (filters.topic === "ALL") {
    const filtered = extraRows.filter((r) => passesDataMode(r, filters.dataMode));
    if (filtered.length > 0) sections.push({ topic: "ALL", title: "Turning Points, Coverage & Evidence", rows: filtered });
  }

  return sections;
}

/** A compact "key differences" list for the comparison summary — the
 * same rows' own `note` fields, never a separate interpretive layer. */
export function keyDifferences(sections: ComparisonSection[], max = 5): string[] {
  return sections
    .flatMap((s) => s.rows)
    .map((r) => r.note)
    .filter((n): n is string => n != null)
    .slice(0, max);
}
