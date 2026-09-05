/**
 * The Data Coverage & Confidence Center — a transparency layer that
 * answers "how much usable data do we actually have about this person",
 * one intelligence dimension at a time. It is deliberately not a single
 * number: coverage is dimension-specific (Identity, Career, News,
 * Evidence, Claims, Controversies, Sentiment, Attention, YouTube,
 * Reddit, Wikipedia, Historical, Source Diversity), and every level and
 * reason traces to a real, already-fetched count on the profile — never
 * invented, never derived from popularity, and never folded into
 * CritiScore or sentiment.
 *
 * Like the Evidence & Source Explorer and Claim Verification Matrix
 * before it, this is a read-time derivation over `RealProfile` — no new
 * fetch, no new Firestore collection. The spec's own backend pipeline
 * (calculate on the server, cache in Firestore) is the right shape for
 * a system with its own coverage-refresh schedule; this ships the same
 * dimension-by-dimension model and thresholds client-side so it is live
 * immediately, and documents that tradeoff rather than hiding it.
 */

import type { MediaLink, RealProfile, TrendPoint } from "./api";
import type { Controversy } from "./controversy";
import type { CareerIntelligence } from "./career";
import type { ProfessionalIdentity } from "./professional-identity";
import type { EvidenceItem } from "./evidence";
import type { Claim } from "./claims";
import { sentimentConfidence } from "./confidence";

export const COVERAGE_VERSION = "coverage-1";

export type CoverageLevel = "high" | "medium" | "low" | "insufficient" | "unavailable";

export const COVERAGE_LEVEL_LABEL: Record<CoverageLevel, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
  insufficient: "Insufficient",
  unavailable: "Unavailable",
};

export type DataStatus =
  | "available"
  | "limited"
  | "insufficient"
  | "conflicting"
  | "unavailable"
  | "not_applicable";

export const DATA_STATUS_LABEL: Record<DataStatus, string> = {
  available: "Available",
  limited: "Limited",
  insufficient: "Insufficient",
  conflicting: "Conflicting",
  unavailable: "Unavailable",
  not_applicable: "Not applicable",
};

export type CoverageDimensionKey =
  | "identity"
  | "professional"
  | "career"
  | "news"
  | "evidence"
  | "claims"
  | "controversies"
  | "sentiment"
  | "attention"
  | "youtube"
  | "reddit"
  | "wikipedia"
  | "historical"
  | "sourceDiversity";

export const DIMENSION_LABEL: Record<CoverageDimensionKey, string> = {
  identity: "Entity Identity",
  professional: "Professional Identity",
  career: "Career",
  news: "News",
  evidence: "Evidence",
  claims: "Claims",
  controversies: "Controversies",
  sentiment: "Sentiment",
  attention: "Attention",
  youtube: "YouTube",
  reddit: "Reddit",
  wikipedia: "Wikipedia",
  historical: "Historical Data",
  sourceDiversity: "Source Diversity",
};

export interface TimeRange {
  earliest: string | null;
  latest: string | null;
  /** Only set when a gap was actually detected between consecutive
   * points — never guessed. */
  gapNote?: string | null;
}

export interface CoverageDimension {
  key: CoverageDimensionKey;
  label: string;
  level: CoverageLevel;
  status: DataStatus;
  /** Calculated facts only, in display order — never a free-text guess. */
  reasons: string[];
  timeRange?: TimeRange | null;
}

export interface CoverageReport {
  dimensions: CoverageDimension[];
  coverageVersion: string;
}

function dim(
  key: CoverageDimensionKey,
  level: CoverageLevel,
  status: DataStatus,
  reasons: string[],
  timeRange?: TimeRange | null,
): CoverageDimension {
  return { key, label: DIMENSION_LABEL[key], level, status, reasons, timeRange: timeRange ?? null };
}

function dateSpan(dates: (string | null | undefined)[]): TimeRange | null {
  const sorted = dates.filter((d): d is string => !!d).sort();
  if (sorted.length === 0) return null;
  return { earliest: sorted[0], latest: sorted[sorted.length - 1] };
}

/** A gap note when two consecutive daily points are more than `maxDays`
 * apart — the only "known gap" this module will ever report, because it
 * is the only one it can actually observe from real timestamps. */
function largestGap(dates: string[], maxDays: number): string | null {
  const sorted = [...new Set(dates)].sort();
  let worstSpan = 0;
  let worstStart = "";
  let worstEnd = "";
  for (let i = 1; i < sorted.length; i++) {
    const days = (Date.parse(sorted[i]) - Date.parse(sorted[i - 1])) / 86_400_000;
    if (days > worstSpan) {
      worstSpan = days;
      worstStart = sorted[i - 1];
      worstEnd = sorted[i];
    }
  }
  if (worstSpan <= maxDays) return null;
  return `${worstStart} to ${worstEnd}`;
}

// ── Identity ─────────────────────────────────────────────────────────

export function identityCoverage(
  wikidataId: string | undefined,
  resolution: RealProfile["resolution"],
): CoverageDimension {
  if (!wikidataId) {
    return dim("identity", "unavailable", "unavailable", [
      "No Wikidata entity was resolved for this name.",
    ]);
  }
  const reasons = [`Wikidata resolution: ${resolution}`, `Stable entity ID (${wikidataId})`];
  switch (resolution) {
    case "high":
      return dim("identity", "high", "available", reasons);
    case "medium":
      return dim("identity", "medium", "limited", reasons);
    case "low":
      return dim("identity", "low", "insufficient", reasons);
    case "ambiguous":
      return dim("identity", "insufficient", "conflicting", [
        ...reasons,
        "Multiple similarly-scored candidates were found.",
      ]);
  }
}

// ── Professional identity ───────────────────────────────────────────

export function professionalCoverage(p: ProfessionalIdentity): CoverageDimension {
  if (p.empty) {
    return dim("professional", "unavailable", "unavailable", [
      "No occupation data resolved from Wikidata.",
    ]);
  }
  const resolved = (p.primary ? 1 : 0) + p.secondary.length;
  const reasons = [`${resolved} resolved occupation${resolved === 1 ? "" : "s"}`];
  if (p.unresolved.length > 0) {
    reasons.push(`${p.unresolved.length} unresolved label${p.unresolved.length === 1 ? "" : "s"}`);
  }
  if (resolved >= 2) return dim("professional", "high", "available", reasons);
  if (resolved === 1) return dim("professional", "medium", "available", reasons);
  return dim("professional", "low", "limited", [
    ...reasons,
    p.roles.length > 0 ? `${p.roles.length} free-text role(s) only` : "no structured occupation resolved",
  ]);
}

// ── Career ───────────────────────────────────────────────────────────

export function careerCoverage(c: CareerIntelligence): CoverageDimension {
  const n = c.timeline.length;
  if (!c.available || n === 0) {
    return dim("career", "unavailable", "unavailable", ["No sourced career records found."]);
  }
  const sourced = c.timeline.filter((e) => e.source.url).length;
  const years = c.timeline.flatMap((e) => [e.start, e.end]).filter((y): y is number => y != null);
  const span = years.length > 0 ? `${Math.min(...years)}–${Math.max(...years)}` : null;
  const reasons = [`${n} sourced career record${n === 1 ? "" : "s"}`];
  if (span) reasons.push(`Coverage: ${span}`);
  if (sourced < n) reasons.push(`${n - sourced} record(s) without a direct source link`);

  const level: CoverageLevel = n >= 6 ? "high" : n >= 3 ? "medium" : "low";
  const status: DataStatus = sourced === 0 ? "insufficient" : sourced < n ? "limited" : "available";
  return dim("career", level, status, reasons, span ? { earliest: `${Math.min(...years)}`, latest: `${Math.max(...years)}` } : null);
}

// ── News ─────────────────────────────────────────────────────────────

function mediaOfType(media: MediaLink[], type: string): MediaLink[] {
  return media.filter((m) => m.type === type);
}

export function newsCoverage(media: MediaLink[]): CoverageDimension {
  const news = mediaOfType(media, "news");
  const n = news.length;
  if (n === 0) {
    return dim("news", "unavailable", "unavailable", ["No relevant news articles were retrieved."]);
  }
  const publishers = new Set(news.map((m) => m.source).filter(Boolean)).size;
  const span = dateSpan(news.map((m) => m.publishedAt));
  const reasons = [
    `${n} relevant article${n === 1 ? "" : "s"}`,
    `${publishers} independent publisher${publishers === 1 ? "" : "s"}`,
  ];
  const level: CoverageLevel =
    n >= 50 && publishers >= 5 ? "high" : n >= 10 && publishers >= 2 ? "medium" : "low";
  const status: DataStatus = publishers >= 2 ? "available" : "limited";
  return dim("news", level, status, reasons, span);
}

// ── Evidence ─────────────────────────────────────────────────────────

export function evidenceCoverage(items: EvidenceItem[]): CoverageDimension {
  const total = items.length;
  if (total === 0) {
    return dim("evidence", "unavailable", "unavailable", ["No evidence records were built for this profile."]);
  }
  const corroborated = items.filter((e) => e.evidenceStrength === "strong" || e.evidenceStrength === "moderate").length;
  const conflicting = items.some((e) => e.evidenceStrength === "conflicting");
  const sourceTypes = new Set(items.map((e) => e.sourceType)).size;
  const reasons = [
    `${total} evidence record${total === 1 ? "" : "s"}`,
    `${sourceTypes} source type${sourceTypes === 1 ? "" : "s"} represented`,
    `${corroborated} well-corroborated`,
  ];
  const level: CoverageLevel = corroborated >= 3 ? "high" : corroborated >= 1 ? "medium" : "low";
  const status: DataStatus = conflicting ? "conflicting" : corroborated > 0 ? "available" : "insufficient";
  return dim("evidence", level, status, reasons);
}

// ── Claims ───────────────────────────────────────────────────────────

export function claimsCoverage(claims: Claim[], controversyCount: number): CoverageDimension {
  if (controversyCount === 0) {
    return dim("claims", "unavailable", "not_applicable", [
      "No documented controversies exist to derive claims from.",
    ]);
  }
  const total = claims.length;
  const resolved = claims.filter((c) => c.status === "supported" || c.status === "resolved_authoritative").length;
  const conflicting = claims.filter((c) => c.status === "conflicting").length;
  const reasons = [`${total} structured claim${total === 1 ? "" : "s"}`, `${resolved} supported or resolved`];
  if (conflicting > 0) reasons.push(`${conflicting} conflicting`);
  const level: CoverageLevel = total === 0 ? "unavailable" : resolved / total >= 0.5 ? "high" : resolved > 0 ? "medium" : "low";
  const status: DataStatus = conflicting > 0 ? "conflicting" : total === 0 ? "unavailable" : "available";
  return dim("claims", level, status, reasons);
}

// ── Controversies ────────────────────────────────────────────────────

export function controversiesCoverage(controversies: Controversy[]): CoverageDimension {
  const n = controversies.length;
  if (n === 0) {
    // Never "no controversies exist" — that reads as a clean-record
    // verdict this system cannot actually make.
    return dim("controversies", "insufficient", "insufficient", [
      "No supported controversy records are currently available.",
    ]);
  }
  const reasons = [`${n} documented, corroborated episode${n === 1 ? "" : "s"}`];
  const level: CoverageLevel = n >= 3 ? "high" : "medium";
  return dim("controversies", level, "available", reasons);
}

// ── Sentiment ────────────────────────────────────────────────────────

export function sentimentCoverage(profile: {
  sampleSize: number | null;
  confidence?: number;
  trend: TrendPoint[];
  media: MediaLink[];
}): CoverageDimension {
  if (!profile.sampleSize) {
    return dim("sentiment", "unavailable", "unavailable", ["No sentiment sample was collected."]);
  }
  const publishers = new Set(
    profile.media.filter((m) => m.sentimentTag).map((m) => m.source).filter(Boolean),
  ).size;
  const days = profile.trend.length;
  const badge = profile.confidence != null ? sentimentConfidence(profile.confidence) : null;
  const level: CoverageLevel = badge?.level === "high" ? "high" : badge?.level === "moderate" ? "medium" : "low";
  const reasons = [`${profile.sampleSize} analyzed mention${profile.sampleSize === 1 ? "" : "s"}`];
  if (days > 0) reasons.push(`${days}-day trend window`);
  if (publishers > 0) reasons.push(`coverage from ${publishers} publisher${publishers === 1 ? "" : "s"}`);
  reasons.push(badge ? `method agreement: ${badge.label.replace(" confidence", "")}` : "method agreement not computed");
  const span = dateSpan(profile.trend.map((t) => t.date));
  return dim("sentiment", level, level === "low" ? "limited" : "available", reasons, span);
}

// ── Attention (Wikipedia pageviews) ─────────────────────────────────

export function attentionCoverage(attention: RealProfile["attention"]): CoverageDimension {
  if (!attention || attention.series.length === 0) {
    return dim("attention", "unavailable", "unavailable", ["No pageview series is available."]);
  }
  const n = attention.series.length;
  const reasons = [`${n} day${n === 1 ? "" : "s"} of pageview data`, `source: ${attention.source}`];
  const span = dateSpan(attention.series.map((p) => p.date));
  const level: CoverageLevel = n >= 60 ? "high" : n >= 14 ? "medium" : "low";
  return dim("attention", level, "available", reasons, span);
}

// ── YouTube / Reddit ─────────────────────────────────────────────────

function platformCoverage(
  key: "youtube" | "reddit",
  media: MediaLink[],
): CoverageDimension {
  const items = mediaOfType(media, key);
  const n = items.length;
  if (n === 0) {
    return dim(key, "unavailable", "unavailable", [`No relevant ${key === "youtube" ? "videos" : "posts"} were retrieved.`]);
  }
  const distinct = new Set(items.map((m) => m.channel || m.source).filter(Boolean)).size;
  const span = dateSpan(items.map((m) => m.publishedAt));
  const reasons = [
    `${n} relevant ${key === "youtube" ? "video" : "post"}${n === 1 ? "" : "s"}`,
    `${distinct} distinct ${key === "youtube" ? "channel" : "source"}${distinct === 1 ? "" : "s"}`,
  ];
  const level: CoverageLevel = n >= 20 && distinct >= 3 ? "high" : n >= 5 ? "medium" : "low";
  return dim(key, level, "available", reasons, span);
}

export const youtubeCoverage = (media: MediaLink[]) => platformCoverage("youtube", media);
export const redditCoverage = (media: MediaLink[]) => platformCoverage("reddit", media);

// ── Wikipedia ────────────────────────────────────────────────────────

export function wikipediaCoverage(profile: {
  summary: string;
  background: string;
  imageSource?: string;
}): CoverageDimension {
  const hasText = !!(profile.summary || profile.background);
  const fromWikipedia = profile.imageSource === "wikipedia" || hasText;
  if (!fromWikipedia) {
    return dim("wikipedia", "unavailable", "unavailable", ["No Wikipedia summary or image was retrieved."]);
  }
  const reasons = [hasText ? "biography extract retrieved" : "image only, no extract retrieved"];
  return dim("wikipedia", hasText ? "high" : "low", hasText ? "available" : "limited", reasons);
}

// ── Historical data (sentiment snapshot trend) ──────────────────────

export function historicalCoverage(trend: TrendPoint[]): CoverageDimension {
  const n = trend.length;
  if (n === 0) {
    return dim("historical", "unavailable", "unavailable", ["No historical snapshots have been recorded yet."]);
  }
  const span = dateSpan(trend.map((t) => t.date));
  const gap = largestGap(trend.map((t) => t.date), 7);
  const reasons = [`${n} historical snapshot${n === 1 ? "" : "s"}`];
  if (span?.earliest) reasons.push(`Coverage begins: ${span.earliest}`);
  const level: CoverageLevel = n >= 30 ? "high" : n >= 7 ? "medium" : "low";
  const status: DataStatus = gap ? "limited" : n < 7 ? "insufficient" : "available";
  const timeRange: TimeRange | null = gap
    ? { earliest: span?.earliest ?? null, latest: span?.latest ?? null, gapNote: gap }
    : span;
  return dim("historical", level, status, reasons, timeRange);
}

// ── Source diversity (cross-cutting) ────────────────────────────────

export function sourceDiversityCoverage(media: MediaLink[], evidenceItems: EvidenceItem[]): CoverageDimension {
  const mediaSources = new Set(media.map((m) => m.source).filter(Boolean));
  const evidenceSources = new Set(evidenceItems.map((e) => e.sourceName).filter(Boolean));
  const all = new Set([...mediaSources, ...evidenceSources]);
  const total = all.size;
  if (total === 0) {
    return dim("sourceDiversity", "unavailable", "unavailable", ["No sources were retrieved."]);
  }
  const reasons = [`${total} distinct source${total === 1 ? "" : "s"} contributed data`];
  const level: CoverageLevel = total >= 10 ? "high" : total >= 4 ? "medium" : "low";
  return dim("sourceDiversity", level, "available", reasons);
}

// ── Report assembly ──────────────────────────────────────────────────

export function buildCoverageReport(input: {
  profile: RealProfile;
  evidenceItems: EvidenceItem[];
  claims: Claim[];
}): CoverageReport {
  const { profile, evidenceItems, claims } = input;
  const dimensions = [
    identityCoverage(profile.wikidataId, profile.resolution),
    professionalCoverage(profile.professional),
    careerCoverage(profile.career),
    newsCoverage(profile.media),
    evidenceCoverage(evidenceItems),
    claimsCoverage(claims, profile.controversies.length),
    controversiesCoverage(profile.controversies),
    sentimentCoverage(profile),
    attentionCoverage(profile.attention),
    youtubeCoverage(profile.media),
    redditCoverage(profile.media),
    wikipediaCoverage(profile),
    historicalCoverage(profile.trend),
    sourceDiversityCoverage(profile.media, evidenceItems),
  ];
  return { dimensions, coverageVersion: COVERAGE_VERSION };
}

/** For the compact profile card — the handful of dimensions a reader
 * cares about first, in the spec's example order. Never the whole set:
 * the point of the compact card is to be a summary, not a dashboard. */
export const SUMMARY_DIMENSIONS: CoverageDimensionKey[] = [
  "identity",
  "career",
  "news",
  "evidence",
  "sentiment",
  "youtube",
  "historical",
];

export function summaryDimensions(report: CoverageReport): CoverageDimension[] {
  const byKey = new Map(report.dimensions.map((d) => [d.key, d]));
  return SUMMARY_DIMENSIONS.map((k) => byKey.get(k)).filter((d): d is CoverageDimension => !!d);
}

