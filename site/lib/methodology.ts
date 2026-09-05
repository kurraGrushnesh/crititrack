/**
 * Methodology & Audit Trail — ties every calculated number on a profile
 * back to (a) the version of the code that produced it, (b) when it was
 * calculated, and (c) the real, already-computed inputs behind it.
 *
 * Nothing here recalculates an authoritative result. CritiScore stays
 * `computeControversyIndex`'s deterministic formula, sentiment stays the
 * backend's three-method ensemble, evidence stays Step 11's strength
 * rules, coverage stays Step 13's dimension calculations — this module
 * only reads their existing outputs and existing version constants and
 * packages them for display. Where a component of a "breakdown" is not
 * actually exposed by the underlying calculation, this never invents
 * one: it surfaces the real decomposition that exists
 * (`explainControversyIndex`'s per-episode weights), not a fabricated
 * set of category totals.
 */

import type { Controversy } from "./controversy";
import type { RealProfile } from "./api";
import type { Claim } from "./claims";
import type { EvidenceItem } from "./evidence";
import {
  computeControversyIndex,
  explainControversyIndex,
  indexConfidence,
  CRITISCORE_METHODOLOGY_VERSION,
  type IndexExplanation,
  type IndexConfidence,
} from "./controversy-index";
import { SENTIMENT_METHODOLOGY_VERSION } from "./sentiment";
import { EVIDENCE_METHODOLOGY_VERSION } from "./evidence";
import { METHODOLOGY_VERSION as CLAIMS_METHODOLOGY_VERSION } from "./claims";
import { COVERAGE_VERSION } from "./coverage";
import { TIMELINE_METHODOLOGY_VERSION } from "./timeline";
import { HISTORICAL_METHODOLOGY_VERSION } from "./historical";

export type MethodologySystem =
  | "entityResolution"
  | "evidence"
  | "claims"
  | "critiscore"
  | "sentiment"
  | "timeline"
  | "coverage"
  | "historical";

export interface SystemVersion {
  system: MethodologySystem;
  label: string;
  version: string;
}

/**
 * Entity Resolution has no independent version constant of its own — it
 * is server-computed (`functions/lib/entity.js`) and only the resolution
 * band (`high`/`medium`/`low`/`ambiguous`) reaches the client. "1.0"
 * documents the first formally tracked version of that client-visible
 * behaviour; it is not a claim about the backend's own internal history.
 */
export const ENTITY_RESOLUTION_METHODOLOGY_VERSION = "1.0";

export const SYSTEM_VERSIONS: readonly SystemVersion[] = [
  { system: "entityResolution", label: "Entity Resolution", version: ENTITY_RESOLUTION_METHODOLOGY_VERSION },
  { system: "evidence", label: "Evidence & Sources", version: EVIDENCE_METHODOLOGY_VERSION },
  { system: "claims", label: "Claim Verification", version: CLAIMS_METHODOLOGY_VERSION },
  { system: "critiscore", label: "CritiScore", version: CRITISCORE_METHODOLOGY_VERSION },
  { system: "sentiment", label: "Public Sentiment", version: SENTIMENT_METHODOLOGY_VERSION },
  { system: "timeline", label: "Timeline", version: TIMELINE_METHODOLOGY_VERSION },
  { system: "coverage", label: "Data Coverage", version: COVERAGE_VERSION },
  { system: "historical", label: "Historical Intelligence", version: HISTORICAL_METHODOLOGY_VERSION },
];

export function systemVersion(system: MethodologySystem): string {
  return SYSTEM_VERSIONS.find((s) => s.system === system)?.version ?? "unversioned";
}

// ── Audit metadata (shared shape for "Calculated / Method / Confidence") ─

export interface AuditMeta {
  system: MethodologySystem;
  label: string;
  version: string;
  /** The real timestamp available for this data — always the profile's
   * own `fetchedAt`, since CritiTrack does not currently store a
   * separate per-calculation timestamp. Never invented. */
  calculatedAt: string;
  confidence: string | null;
}

function baseAudit(system: MethodologySystem, profile: { fetchedAt: string }, confidence: string | null): AuditMeta {
  const meta = SYSTEM_VERSIONS.find((s) => s.system === system)!;
  return { system, label: meta.label, version: meta.version, calculatedAt: profile.fetchedAt, confidence };
}

// ── CritiScore score audit ────────────────────────────────────────────

export interface ScoreAudit extends AuditMeta {
  score: number;
  explanation: IndexExplanation;
  indexConfidence: IndexConfidence | null;
}

/**
 * The real CritiScore breakdown: {@link explainControversyIndex}'s
 * per-episode arithmetic (severity base × recency factor × ongoing
 * factor, and each episode's resulting share of the final score), not a
 * fabricated set of named buckets. That is the actual decomposition the
 * formula has — nothing else is exposed by the code, so nothing else is
 * shown here.
 */
export function buildScoreAudit(
  profile: { fetchedAt: string },
  controversies: Controversy[],
  currentYear?: number,
): ScoreAudit {
  const index = computeControversyIndex(controversies, currentYear);
  const explanation = explainControversyIndex(controversies, currentYear);
  const confidence = indexConfidence(controversies);
  return {
    ...baseAudit("critiscore", profile, confidence?.level ?? null),
    score: index.score,
    explanation,
    indexConfidence: confidence,
  };
}

// ── Sentiment audit ────────────────────────────────────────────────────

export interface SentimentAudit extends AuditMeta {
  sampleSize: number | null;
  methodAgreement: number | null;
  /** "Available" only when the backend actually returned a numeric
   * agreement figure — never inferred. */
  methodAgreementStatus: "Available" | "Not available";
  periodDays: number | null;
}

export function buildSentimentAudit(profile: RealProfile): SentimentAudit {
  const confidenceLabel =
    profile.confidenceLabel ?? (profile.confidence != null ? `${Math.round(profile.confidence * 100)}%` : null);
  return {
    ...baseAudit("sentiment", profile, confidenceLabel),
    sampleSize: profile.sampleSize,
    methodAgreement: profile.methodAgreement,
    methodAgreementStatus: profile.methodAgreement != null ? "Available" : "Not available",
    periodDays: profile.trend.length > 0 ? profile.trend.length : null,
  };
}

// ── Evidence / claim audit ─────────────────────────────────────────────

export interface EvidenceAudit extends AuditMeta {
  supportingCount: number;
  contradictingCount: number;
  responseCount: number;
  independentPublishers: number;
  status: string;
}

/**
 * Audit detail for one claim: its own evidence-relationship counts
 * (already computed by Step 12's `Claim`) plus a real independent-
 * publisher count over its supporting evidence — never re-derives the
 * claim's status, only reports it.
 */
export function buildEvidenceAudit(
  profile: { fetchedAt: string },
  claim: Claim,
  evidenceItems: EvidenceItem[],
): EvidenceAudit {
  const byId = new Map(evidenceItems.map((e) => [e.evidenceId, e]));
  const supporting = claim.supportingEvidenceIds.map((id) => byId.get(id)).filter((e): e is EvidenceItem => !!e);
  const publishers = new Set(supporting.map((e) => e.sourceName)).size;
  return {
    ...baseAudit("claims", profile, claim.confidence),
    supportingCount: claim.supportingEvidenceIds.length,
    contradictingCount: claim.contradictingEvidenceIds.length,
    responseCount: claim.responseEvidenceIds.length,
    independentPublishers: publishers,
    status: claim.status,
  };
}

// ── Methodology page content ───────────────────────────────────────────

export interface MethodologySection {
  id: string;
  title: string;
  system: MethodologySystem | null;
  paragraphs: string[];
}

/**
 * Plain-language descriptions of each system, for the public
 * methodology page. Every sentence here describes real, shipped
 * behaviour from the corresponding module — nothing aspirational, no
 * internal implementation detail, no credentials or infrastructure.
 */
export const METHODOLOGY_SECTIONS: readonly MethodologySection[] = [
  {
    id: "entity-resolution",
    title: "Entity Resolution",
    system: "entityResolution",
    paragraphs: [
      "A searched name is matched against Wikidata using more than the name alone — occupation, notability (sitelink count), and, where available, aliases and dates are weighed together, because name-only matching cannot tell two same-named people apart.",
      "The result is a confidence band — high, medium, low, or ambiguous — never a bare yes/no. When several real people plausibly match, CritiTrack shows the alternatives rather than silently picking one.",
    ],
  },
  {
    id: "evidence",
    title: "Evidence & Sources",
    system: "evidence",
    paragraphs: [
      "Every retrieved article, video or citation is normalised into one evidence record: its source type, publication date, and whether it is linked to a specific documented controversy by genuine word-overlap with that controversy's own title — never merely by mentioning the same person.",
      "Syndicated copies of the same story are grouped, not counted as separate confirmations: 'reported by 3 independent publishers' reflects distinct publishers, not raw article count. More articles from the same wire copy is one report, not several.",
    ],
  },
  {
    id: "claims",
    title: "Claim Verification",
    system: "claims",
    paragraphs: [
      "A controversy is broken into the discrete things actually claimed — that an event was reported, that someone denied it, that a body investigated it, that an authority ruled on it — each with its own supporting, contradicting, and response evidence.",
      "Status is always evidence-based: 'supported', 'conflicting', 'reported / not independently corroborated', or similar — never 'true', 'false', 'guilty', or 'innocent', unless a cited source is itself an authoritative finding, in which case CritiTrack states what that record says rather than forming its own judgment.",
    ],
  },
  {
    id: "critiscore",
    title: "CritiScore",
    system: "critiscore",
    paragraphs: [
      "CritiScore is calculated by fixed, deterministic code — never a language model — from the person's documented, corroborated controversy records. Each episode contributes a weight from its severity (1–5), a recency factor (recent episodes count more, capped after roughly two years of decay), and whether it is still unresolved (weighted 1.25×).",
      "Weights are summed, then compressed by 100 · (1 − 1 / (1 + sum)): one severe, recent, unresolved episode lands near 50; more episodes push the score toward, but never reach, 100.",
      "Score bands: 0–19 Very Low, 20–39 Low, 40–59 Moderate, 60–79 High, 80–100 Very High.",
      "Follower counts, view counts, and sentiment never enter this calculation directly — only the structured, sourced controversy records themselves.",
    ],
  },
  {
    id: "sentiment",
    title: "Public Sentiment",
    system: "sentiment",
    paragraphs: [
      "Sentiment is scored by a three-method ensemble — a general-purpose lexicon, a reputation-tuned lexicon, and a batched language-model pass — blended with a reach weighting, because a front-page story and a low-view upload are not equally informative.",
      "The spread between the three methods becomes the confidence band shown alongside the score: when the methods agree, confidence is high; when they diverge or too little was found, it reads low, meaning 'treat this as a rough direction' rather than a precise figure.",
      "Sentiment measures the tone of analysed coverage, not the truth of any claim. Negative sentiment is not proof of wrongdoing, and positive sentiment does not disprove an allegation — the two systems are computed independently and never feed into one another.",
    ],
  },
  {
    id: "attention-trending",
    title: "Attention & Trending",
    system: null,
    paragraphs: [
      "Attention tracks actual Wikipedia pageviews over time — a real, external, unweighted signal of how many people looked something up. It has no direction: a spike means attention, not approval or disapproval.",
      "Trending/discovery ranking (used for search and category ordering) is a separate, popularity-aware signal used only to help people find a profile — it never feeds into CritiScore, evidence strength, or claim status.",
    ],
  },
  {
    id: "timeline",
    title: "Timeline",
    system: "timeline",
    paragraphs: [
      "The timeline merges every dated thing CritiTrack actually knows about a person onto one axis: controversies, career and organisation changes, clustered news coverage (at least two sources on the same day), attention spikes, and sharp sentiment shifts.",
      "An event's shown importance is a plain read of a real signal already on it — severity, source count, view multiple, or sentiment delta — always displayed with the number behind it, never an invented score, and never based on popularity alone.",
      "'Connections' between nearby events describe temporal correlation only — that two things happened close together — never a claim that one caused the other.",
    ],
  },
  {
    id: "data-coverage",
    title: "Data Coverage",
    system: "coverage",
    paragraphs: [
      "Coverage measures how much usable data CritiTrack actually has for a person, one dimension at a time (identity, career, news, evidence, sentiment, and more) — high, medium, low, insufficient, or unavailable. It is never a single combined score, and it is never derived from popularity.",
      "A low-coverage dimension means a real gap in what was retrieved — not a negative finding about the person. A person with genuinely no documented controversies reads 'no supported controversy records are currently available', never 'no controversies exist' or 'clean record'.",
    ],
  },
  {
    id: "historical-intelligence",
    title: "Historical Intelligence",
    system: "historical",
    paragraphs: [
      "Historical Intelligence answers what has happened to a person over time by reassembling data every other system already computes — measured daily sentiment snapshots, the CritiScore reconstruction, the dated career timeline, and Change Detection's own log — into one composite view. It never recomputes or re-weights any of them.",
      "CritiTrack does not yet run a backend-authoritative snapshot store, so a historical point is anchored to a real measured sentiment date and overlaid with each other system's own real granularity — a yearly CritiScore reconstruction, a dated career role, a dated controversy count. Where a dimension has no real anchor at that point, it is shown as a gap, never interpolated or guessed.",
      "'Major turning points' are a merge of existing signals — a sharp year-over-year CritiScore reconstruction move, a dated career transition, a MAJOR or SIGNIFICANT Change Detection event — sorted by date. There is no separate 'turning point score': every point traces back to a number or event shown elsewhere on the profile.",
      "A provider outage or a quiet news day is never read as an absence of history: historical coverage is judged only by how much real dated history has already accumulated, using the same coverage vocabulary (high/medium/low/insufficient/unavailable) as the Data Coverage Center.",
    ],
  },
  {
    id: "limitations",
    title: "Limitations",
    system: null,
    paragraphs: [
      "Sentiment scores, controversy severities, and CritiScore are algorithmically assessed, not verified fact. The accuracy benchmark comparing the sentiment ensemble against each method alone is run on a small seed set and is not a publishable accuracy claim — the benchmark's own documentation says so.",
      "Coverage-threshold numbers (for example, what counts as 'high' news coverage) are disclosed heuristics tuned for readability, not a formally validated statistical scale.",
      "If a profile is about you and something is wrong, use the correction form linked from that profile.",
    ],
  },
];
