/**
 * Change Detection — compares two real snapshots of the same profile
 * (the last one this browser actually saw, from `profile-cache.ts`, and
 * the one just fetched) and surfaces only the differences that are
 * actually meaningful: a new sourced career role, a controversy that
 * became better or worse corroborated, a claim's status changing, a
 * genuine sentiment-band shift with enough sample to mean something, a
 * CritiScore move, a coverage-dimension level change. It never diffs raw
 * JSON — every comparison reads the same normalised, already-computed
 * fields the rest of the app renders (career timeline, claims, coverage
 * report, the deterministic index), so noise like array order, image
 * URLs, or a refreshed timestamp never becomes a "change".
 *
 * Known, disclosed limitation: CritiTrack has no backend snapshot store
 * for full profiles (only daily sentiment snapshots). This module
 * therefore compares against the browser's own local last-seen cache,
 * not a server-authoritative previous state — it only has something to
 * compare against once a reader has viewed the same profile before on
 * the same device. A true cross-device, backend-owned change feed (as
 * the spec's recommended pipeline describes) would need a server-side
 * snapshot collection this project does not yet have; that is out of
 * scope for a client-only implementation and is called out explicitly
 * wherever this module is surfaced.
 */

import type { RealProfile, MediaLink } from "./api";
import type { Controversy } from "./controversy";
import type { CareerEntry } from "./career";
import { sentimentBand } from "./sentiment";
import { computeControversyIndex, indexConfidence } from "./controversy-index";
import { buildEvidenceItems } from "./evidence";
import { buildClaimMatrix, titleSlug, type Claim, type ClaimStatus } from "./claims";
import { buildCoverageReport, type CoverageDimensionKey, type CoverageLevel } from "./coverage";

export const CHANGE_METHODOLOGY_VERSION = "1.0";

export type ChangeType =
  | "CAREER_CHANGE"
  | "PROFESSION_CHANGE"
  | "ORGANIZATION_CHANGE"
  | "CONTROVERSY_CHANGE"
  | "CLAIM_CHANGE"
  | "NEWS_CHANGE"
  | "SENTIMENT_CHANGE"
  | "ATTENTION_CHANGE"
  | "CRITISCORE_CHANGE"
  | "RELATIONSHIP_CHANGE"
  | "PROFILE_CHANGE"
  | "SOURCE_COVERAGE_CHANGE"
  | "DATA_AVAILABILITY_CHANGE";

export type ChangeSeverity = "INFO" | "MINOR" | "SIGNIFICANT" | "MAJOR";

export type ChangeConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface ChangeEvent {
  changeId: string;
  entityId: string;
  changeType: ChangeType;
  severity: ChangeSeverity;
  title: string;
  summary: string;
  previousValue: string | null;
  currentValue: string | null;
  /** When this comparison was run — real wall-clock time of the fetch
   * that produced `current`, not invented. */
  detectedAt: string;
  /** The date the change itself is dated to, when the underlying data
   * carries one (an episode's year, a career entry's start) — null when
   * only "detected now" is known. */
  effectiveDate: string | null;
  evidenceIds: string[];
  relatedClaimIds: string[];
  /** Links this change to a specific timeline entry, when one exists —
   * reserved for a future pass that stamps timeline event ids back onto
   * the change that produced them. Absent today; never fabricated. */
  relatedEventId?: string | null;
  methodologyVersion: string;
  confidence: ChangeConfidence;
  /** The coverage level backing this change, when relevant (e.g. how
   * many independent publishers support a new controversy). */
  sourceCoverage: string | null;
}

let counter = 0;
function nextId(entityId: string, type: ChangeType): string {
  counter += 1;
  return `${entityId}-${type}-${counter}`;
}

/** Resets the id counter — tests only, so ids are deterministic per run. */
export function resetChangeIdCounter(): void {
  counter = 0;
}

function careerKey(e: CareerEntry): string {
  return `${(e.role ?? "").toLowerCase()}|${(e.organization ?? "").toLowerCase()}|${e.start ?? ""}`;
}

// ── Career & profession ──────────────────────────────────────────────

function careerChanges(
  entityId: string,
  detectedAt: string,
  previous: CareerEntry[],
  current: CareerEntry[],
): ChangeEvent[] {
  const prevKeys = new Set(previous.map(careerKey));
  const out: ChangeEvent[] = [];

  for (const e of current) {
    if (prevKeys.has(careerKey(e))) continue;
    if (!e.role && !e.organization) continue; // nothing meaningful to name
    const who = [e.role, e.organization].filter(Boolean).join(" at ");
    out.push({
      changeId: nextId(entityId, "CAREER_CHANGE"),
      entityId,
      changeType: "CAREER_CHANGE",
      severity: e.source.url ? "MINOR" : "INFO",
      title: `New role detected: ${who}`,
      summary: `A new sourced career record appeared: ${who}${e.start ? ` (from ${e.start})` : ""}.`,
      previousValue: null,
      currentValue: who,
      detectedAt,
      effectiveDate: e.start != null ? `${e.start}` : null,
      evidenceIds: [],
      relatedClaimIds: [],
      methodologyVersion: CHANGE_METHODOLOGY_VERSION,
      confidence: e.source.url ? "HIGH" : "LOW",
      sourceCoverage: e.source.url ? "sourced" : "unsourced",
    });
  }
  return out;
}

function organizationChanges(
  entityId: string,
  detectedAt: string,
  previous: string[],
  current: string[],
): ChangeEvent[] {
  const prevSet = new Set(previous.map((o) => o.toLowerCase()));
  const currSet = new Set(current.map((o) => o.toLowerCase()));
  const out: ChangeEvent[] = [];

  for (const org of current) {
    if (prevSet.has(org.toLowerCase())) continue;
    out.push({
      changeId: nextId(entityId, "ORGANIZATION_CHANGE"),
      entityId,
      changeType: "ORGANIZATION_CHANGE",
      severity: "MINOR",
      title: `New organization: ${org}`,
      summary: `${org} appeared as a new organization in the sourced career record.`,
      previousValue: null,
      currentValue: org,
      detectedAt,
      effectiveDate: null,
      evidenceIds: [],
      relatedClaimIds: [],
      methodologyVersion: CHANGE_METHODOLOGY_VERSION,
      confidence: "MEDIUM",
      sourceCoverage: null,
    });
  }
  for (const org of previous) {
    if (currSet.has(org.toLowerCase())) continue;
    out.push({
      changeId: nextId(entityId, "ORGANIZATION_CHANGE"),
      entityId,
      changeType: "ORGANIZATION_CHANGE",
      severity: "MINOR",
      title: `No longer listed at: ${org}`,
      summary: `${org} no longer appears in the sourced career record.`,
      previousValue: org,
      currentValue: null,
      detectedAt,
      effectiveDate: null,
      evidenceIds: [],
      relatedClaimIds: [],
      methodologyVersion: CHANGE_METHODOLOGY_VERSION,
      confidence: "MEDIUM",
      sourceCoverage: null,
    });
  }
  return out;
}

function professionChange(
  entityId: string,
  detectedAt: string,
  previous: string,
  current: string,
): ChangeEvent[] {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  if (!current || norm(previous) === norm(current)) return [];
  return [
    {
      changeId: nextId(entityId, "PROFESSION_CHANGE"),
      entityId,
      changeType: "PROFESSION_CHANGE",
      severity: "MINOR",
      title: "Profession updated",
      summary: `Listed profession changed from "${previous || "unknown"}" to "${current}".`,
      previousValue: previous || null,
      currentValue: current,
      detectedAt,
      effectiveDate: null,
      evidenceIds: [],
      relatedClaimIds: [],
      methodologyVersion: CHANGE_METHODOLOGY_VERSION,
      confidence: "HIGH",
      sourceCoverage: null,
    },
  ];
}

// ── Controversies & claims ───────────────────────────────────────────

function controversySeverityBand(c: Controversy): ChangeSeverity {
  if (c.severity >= 4) return "MAJOR";
  if (c.severity >= 2) return "SIGNIFICANT";
  return "MINOR";
}

function controversyChanges(
  entityId: string,
  detectedAt: string,
  previous: Controversy[],
  current: Controversy[],
): ChangeEvent[] {
  const prevByKey = new Map(previous.map((c) => [titleSlug(c.title), c]));
  const out: ChangeEvent[] = [];

  for (const c of current) {
    const key = titleSlug(c.title);
    const before = prevByKey.get(key);
    if (!before) {
      // A genuinely new, already-corroborated episode — never fired for
      // a new article about something already tracked (matched by key).
      out.push({
        changeId: nextId(entityId, "CONTROVERSY_CHANGE"),
        entityId,
        changeType: "CONTROVERSY_CHANGE",
        severity: controversySeverityBand(c),
        title: `New supported controversy: ${c.title}`,
        summary: c.summary || c.title,
        previousValue: null,
        currentValue: c.status,
        detectedAt,
        effectiveDate: c.year != null ? `${c.year}` : null,
        evidenceIds: [],
        relatedClaimIds: [],
        methodologyVersion: CHANGE_METHODOLOGY_VERSION,
        confidence: c.sources.length >= 2 ? "HIGH" : c.sources.length === 1 ? "MEDIUM" : "LOW",
        sourceCoverage: `${c.sources.length} source${c.sources.length === 1 ? "" : "s"}`,
      });
      continue;
    }
    if (before.status !== c.status) {
      out.push({
        changeId: nextId(entityId, "CONTROVERSY_CHANGE"),
        entityId,
        changeType: "CONTROVERSY_CHANGE",
        severity: "SIGNIFICANT",
        title: `Controversy status updated: ${c.title}`,
        summary: `Status changed from "${before.status}" to "${c.status}".`,
        previousValue: before.status,
        currentValue: c.status,
        detectedAt,
        effectiveDate: c.year != null ? `${c.year}` : null,
        evidenceIds: [],
        relatedClaimIds: [],
        methodologyVersion: CHANGE_METHODOLOGY_VERSION,
        confidence: "HIGH",
        sourceCoverage: null,
      });
    }
    if (c.sources.length > before.sources.length) {
      out.push({
        changeId: nextId(entityId, "CONTROVERSY_CHANGE"),
        entityId,
        changeType: "CONTROVERSY_CHANGE",
        severity: "MINOR",
        title: `New supporting evidence: ${c.title}`,
        summary: `Source count increased from ${before.sources.length} to ${c.sources.length}.`,
        previousValue: `${before.sources.length} sources`,
        currentValue: `${c.sources.length} sources`,
        detectedAt,
        effectiveDate: null,
        evidenceIds: [],
        relatedClaimIds: [],
        methodologyVersion: CHANGE_METHODOLOGY_VERSION,
        confidence: "MEDIUM",
        sourceCoverage: `${c.sources.length} sources`,
      });
    }
  }
  return out;
}

const CLAIM_STATUS_RANK: Record<ClaimStatus, number> = {
  insufficient_evidence: 0,
  reported_uncorroborated: 1,
  partially_supported: 2,
  conflicting: 2,
  supported: 3,
  resolved_authoritative: 4,
  unknown: -1,
};

function claimChanges(
  entityId: string,
  detectedAt: string,
  previous: Claim[],
  current: Claim[],
): ChangeEvent[] {
  const prevByKey = new Map(previous.map((c) => [c.claimId, c]));
  const out: ChangeEvent[] = [];

  for (const c of current) {
    const before = prevByKey.get(c.claimId);
    // Only transitions on a claim that existed in both snapshots — a
    // brand-new controversy's claims are covered by CONTROVERSY_CHANGE,
    // never double-reported here.
    if (!before || before.status === c.status) continue;

    const improved = CLAIM_STATUS_RANK[c.status] > CLAIM_STATUS_RANK[before.status];
    const newSupport = c.supportingEvidenceIds.filter((id) => !before.supportingEvidenceIds.includes(id));
    const newContradict = c.contradictingEvidenceIds.filter(
      (id) => !before.contradictingEvidenceIds.includes(id),
    );

    let why = c.statusReason;
    if (newSupport.length > 0) why = `${newSupport.length} new supporting source(s) were retrieved.`;
    else if (newContradict.length > 0) why = `${newContradict.length} new contradicting source(s) were retrieved.`;

    out.push({
      changeId: nextId(entityId, "CLAIM_CHANGE"),
      entityId,
      changeType: "CLAIM_CHANGE",
      severity: c.status === "conflicting" ? "SIGNIFICANT" : improved ? "SIGNIFICANT" : "MINOR",
      title: `Claim status changed: ${c.claimText}`,
      summary: why,
      previousValue: before.status,
      currentValue: c.status,
      detectedAt,
      effectiveDate: c.dateContext,
      evidenceIds: [...newSupport, ...newContradict],
      relatedClaimIds: [c.claimId],
      methodologyVersion: c.methodologyVersion,
      confidence: c.confidence === "high" ? "HIGH" : c.confidence === "medium" ? "MEDIUM" : "LOW",
      sourceCoverage: null,
    });
  }
  return out;
}

// ── News (deduplicated by underlying event) ─────────────────────────

const STOPWORDS = new Set([
  "the", "a", "an", "of", "in", "on", "at", "to", "for", "and", "or",
  "is", "was", "were", "be", "been", "with", "by", "from", "as", "his",
  "her", "their", "its", "it", "that", "this", "after", "over", "new",
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

function sameEvent(a: string, b: string): boolean {
  const wa = significantWords(a);
  const wb = significantWords(b);
  if (wa.size < 1 || wb.size < 1) return false;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  return shared / Math.min(wa.size, wb.size) >= 0.6;
}

/**
 * Groups genuinely new articles (present now, absent before, by URL —
 * so a syndicated re-publish of an already-seen link never counts) by
 * same-day + real topical overlap, and only emits a NEWS_CHANGE for a
 * cluster with at least two distinct publishers — one new single-source
 * article is not an "event", it is noise.
 */
function newsChanges(
  entityId: string,
  detectedAt: string,
  previous: MediaLink[],
  current: MediaLink[],
  controversies: Controversy[],
): ChangeEvent[] {
  const prevUrls = new Set(previous.map((m) => m.url));
  const newItems = current.filter((m) => m.type === "news" && !prevUrls.has(m.url));
  if (newItems.length === 0) return [];

  // Already-tracked controversies get their own change type; do not
  // double-report their coverage as a separate "news event".
  const trackedTitles = controversies.map((c) => c.title);
  const untracked = newItems.filter((m) => !trackedTitles.some((t) => sameEvent(t, m.title)));

  const clusters: MediaLink[][] = [];
  for (const item of untracked) {
    const day = item.publishedAt?.slice(0, 10);
    const cluster = clusters.find(
      (c) => c[0].publishedAt?.slice(0, 10) === day && sameEvent(c[0].title, item.title),
    );
    if (cluster) cluster.push(item);
    else clusters.push([item]);
  }

  const out: ChangeEvent[] = [];
  for (const cluster of clusters) {
    const publishers = new Set(cluster.map((m) => m.source)).size;
    if (publishers < 2) continue;
    const rep = cluster[0];
    out.push({
      changeId: nextId(entityId, "NEWS_CHANGE"),
      entityId,
      changeType: "NEWS_CHANGE",
      severity: publishers >= 5 ? "SIGNIFICANT" : "MINOR",
      title: `New event: ${rep.title}`,
      summary: `${cluster.length} article${cluster.length === 1 ? "" : "s"}, ${publishers} independent publisher${publishers === 1 ? "" : "s"}.`,
      previousValue: null,
      currentValue: `${cluster.length} articles`,
      detectedAt,
      effectiveDate: rep.publishedAt ?? null,
      evidenceIds: cluster.map((m) => `media-${m.id}`),
      relatedClaimIds: [],
      methodologyVersion: CHANGE_METHODOLOGY_VERSION,
      confidence: publishers >= 3 ? "HIGH" : "MEDIUM",
      sourceCoverage: `${publishers} independent publishers`,
    });
  }
  return out;
}

// ── Sentiment ─────────────────────────────────────────────────────────

const MIN_SENTIMENT_SAMPLE = 10;

function sentimentChange(
  entityId: string,
  detectedAt: string,
  previous: RealProfile,
  current: RealProfile,
): ChangeEvent[] {
  if (current.sampleSize == null) return [];
  const prevBand = sentimentBand(previous.sentimentScore);
  const currBand = sentimentBand(current.sentimentScore);
  if (prevBand === currBand) return [];

  if (current.sampleSize < MIN_SENTIMENT_SAMPLE) {
    return [
      {
        changeId: nextId(entityId, "SENTIMENT_CHANGE"),
        entityId,
        changeType: "SENTIMENT_CHANGE",
        severity: "INFO",
        title: "Sentiment shift detected but data is limited",
        summary: "Sentiment data insufficient to determine a meaningful change.",
        previousValue: prevBand,
        currentValue: currBand,
        detectedAt,
        effectiveDate: null,
        evidenceIds: [],
        relatedClaimIds: [],
        methodologyVersion: CHANGE_METHODOLOGY_VERSION,
        confidence: "LOW",
        sourceCoverage: `${current.sampleSize} mentions`,
      },
    ];
  }

  const magnitude = Math.abs(current.sentimentScore - previous.sentimentScore);
  const severity: ChangeSeverity = magnitude >= 30 ? "SIGNIFICANT" : "MINOR";
  const confidence: ChangeConfidence =
    current.confidence != null && current.confidence >= 0.75
      ? "HIGH"
      : current.confidence != null && current.confidence >= 0.5
        ? "MEDIUM"
        : "LOW";

  return [
    {
      changeId: nextId(entityId, "SENTIMENT_CHANGE"),
      entityId,
      changeType: "SENTIMENT_CHANGE",
      severity,
      title: `Sentiment shifted ${currBand}`,
      summary: `Sentiment moved from ${prevBand} to ${currBand}, based on ${current.sampleSize} analyzed mentions. This reflects the tone of coverage, not proof of wrongdoing.`,
      previousValue: prevBand,
      currentValue: currBand,
      detectedAt,
      effectiveDate: null,
      evidenceIds: [],
      relatedClaimIds: [],
      methodologyVersion: CHANGE_METHODOLOGY_VERSION,
      confidence,
      sourceCoverage: `${current.sampleSize} mentions`,
    },
  ];
}

// ── Attention (kept strictly separate from controversy) ─────────────

function attentionChange(
  entityId: string,
  detectedAt: string,
  previous: RealProfile,
  current: RealProfile,
): ChangeEvent[] {
  const summary = current.attention?.summary;
  if (!summary) return [];
  const pct = summary.changePct;
  if (Math.abs(pct) < 50) return [];

  const severity: ChangeSeverity = Math.abs(pct) >= 100 ? "SIGNIFICANT" : "MINOR";
  const direction = pct >= 0 ? "increased" : "decreased";

  return [
    {
      changeId: nextId(entityId, "ATTENTION_CHANGE"),
      entityId,
      changeType: "ATTENTION_CHANGE",
      severity,
      title: `Media attention ${direction} ${Math.abs(Math.round(pct))}%`,
      summary:
        `Media attention ${direction} ${Math.abs(Math.round(pct))}% over the previous period. ` +
        "This is a volume signal, not a controversy — it does not by itself indicate wrongdoing.",
      previousValue: null,
      currentValue: `${pct >= 0 ? "+" : ""}${Math.round(pct)}%`,
      detectedAt,
      effectiveDate: null,
      evidenceIds: [],
      relatedClaimIds: [],
      methodologyVersion: CHANGE_METHODOLOGY_VERSION,
      confidence: "MEDIUM",
      sourceCoverage: current.attention?.source ?? null,
    },
  ];
}

// ── CritiScore (deterministic, mirrors the backend formula) ─────────

function critiscoreChange(
  entityId: string,
  detectedAt: string,
  previous: Controversy[],
  current: Controversy[],
): ChangeEvent[] {
  const prevScore = Math.round(computeControversyIndex(previous).score);
  const currScore = Math.round(computeControversyIndex(current).score);
  const delta = currScore - prevScore;
  if (delta === 0) return [];

  const magnitude = Math.abs(delta);
  const severity: ChangeSeverity = magnitude >= 15 ? "MAJOR" : magnitude >= 8 ? "SIGNIFICANT" : "MINOR";
  const confidence = indexConfidence(current);

  const newTitles = new Set(current.map((c) => titleSlug(c.title)));
  const priorTitles = new Set(previous.map((c) => titleSlug(c.title)));
  const added = current.filter((c) => !priorTitles.has(titleSlug(c.title)));
  const removed = previous.filter((c) => !newTitles.has(titleSlug(c.title)));

  let reason = "The set of documented, corroborated episodes changed.";
  if (delta > 0 && added.length > 0) {
    reason = `Score increased primarily because ${added.length} newly supported episode${added.length === 1 ? "" : "s"} increased the evidence/corroboration contribution.`;
  } else if (delta < 0 && removed.length > 0) {
    reason = `Score decreased because ${removed.length} previously counted episode${removed.length === 1 ? "" : "s"} no longer appear in the corroborated record.`;
  } else if (delta > 0) {
    reason = "Score increased as existing episodes moved closer in time (recency weighting) or an episode's status became unresolved.";
  }

  return [
    {
      changeId: nextId(entityId, "CRITISCORE_CHANGE"),
      entityId,
      changeType: "CRITISCORE_CHANGE",
      severity,
      title: `CritiScore ${delta > 0 ? "increased" : "decreased"} ${delta > 0 ? "+" : ""}${delta}`,
      summary: reason,
      previousValue: `${prevScore}`,
      currentValue: `${currScore}`,
      detectedAt,
      effectiveDate: null,
      evidenceIds: [],
      relatedClaimIds: [],
      methodologyVersion: "2.0",
      confidence: confidence?.level === "High" ? "HIGH" : confidence?.level === "Medium" ? "MEDIUM" : "LOW",
      sourceCoverage: null,
    },
  ];
}

// ── Profile metadata ─────────────────────────────────────────────────

function normalizeBio(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function profileChanges(
  entityId: string,
  detectedAt: string,
  previous: RealProfile,
  current: RealProfile,
): ChangeEvent[] {
  const out: ChangeEvent[] = [];
  // Ignore whitespace-only and re-wording noise: only flag when the
  // normalised text actually differs, and only for the field that
  // carries real biographical fact (summary), not free-form background
  // prose that changes wording often without changing meaning.
  if (current.summary && normalizeBio(previous.summary) !== normalizeBio(current.summary)) {
    out.push({
      changeId: nextId(entityId, "PROFILE_CHANGE"),
      entityId,
      changeType: "PROFILE_CHANGE",
      severity: "INFO",
      title: "Biography summary updated",
      summary: "The profile's summary text changed.",
      previousValue: previous.summary || null,
      currentValue: current.summary,
      detectedAt,
      effectiveDate: null,
      evidenceIds: [],
      relatedClaimIds: [],
      methodologyVersion: CHANGE_METHODOLOGY_VERSION,
      confidence: "MEDIUM",
      sourceCoverage: null,
    });
  }
  return out;
}

// ── Data coverage / availability ────────────────────────────────────

const COVERAGE_LABEL: Record<CoverageDimensionKey, string> = {
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

function coverageChanges(
  entityId: string,
  detectedAt: string,
  previous: RealProfile,
  current: RealProfile,
): ChangeEvent[] {
  const prevEvidence = buildEvidenceItems({
    media: previous.media,
    controversies: previous.controversies,
    career: previous.career.timeline,
    sentimentEvidence: previous.evidence,
  });
  const currEvidence = buildEvidenceItems({
    media: current.media,
    controversies: current.controversies,
    career: current.career.timeline,
    sentimentEvidence: current.evidence,
  });
  const prevReport = buildCoverageReport({
    profile: previous,
    evidenceItems: prevEvidence,
    claims: buildClaimMatrix(previous.controversies, prevEvidence),
  });
  const currReport = buildCoverageReport({
    profile: current,
    evidenceItems: currEvidence,
    claims: buildClaimMatrix(current.controversies, currEvidence),
  });
  const prevByKey = new Map(prevReport.dimensions.map((d) => [d.key, d.level]));

  const out: ChangeEvent[] = [];
  for (const d of currReport.dimensions) {
    const before: CoverageLevel | undefined = prevByKey.get(d.key);
    if (!before || before === d.level) continue;

    const wentUnavailable = d.level === "unavailable" && before !== "unavailable";
    const cameBack = before === "unavailable" && d.level !== "unavailable";
    const label = COVERAGE_LABEL[d.key];

    if (wentUnavailable || cameBack) {
      out.push({
        changeId: nextId(entityId, "DATA_AVAILABILITY_CHANGE"),
        entityId,
        changeType: "DATA_AVAILABILITY_CHANGE",
        severity: "INFO",
        title: `${label} data ${wentUnavailable ? "temporarily unavailable" : "available again"}`,
        summary: wentUnavailable
          ? `The ${label} provider returned no usable data this refresh.`
          : `${label} data is available again.`,
        previousValue: before,
        currentValue: d.level,
        detectedAt,
        effectiveDate: null,
        evidenceIds: [],
        relatedClaimIds: [],
        methodologyVersion: currReport.coverageVersion,
        confidence: "MEDIUM",
        sourceCoverage: null,
      });
      continue;
    }

    out.push({
      changeId: nextId(entityId, "SOURCE_COVERAGE_CHANGE"),
      entityId,
      changeType: "SOURCE_COVERAGE_CHANGE",
      severity: "INFO",
      title: `${label} coverage: ${before} → ${d.level}`,
      summary: d.reasons[0] ?? "Coverage level changed.",
      previousValue: before,
      currentValue: d.level,
      detectedAt,
      effectiveDate: null,
      evidenceIds: [],
      relatedClaimIds: [],
      methodologyVersion: currReport.coverageVersion,
      confidence: "HIGH",
      sourceCoverage: null,
    });
  }
  return out;
}

// ── Relationship change — model reserved, not yet populated ─────────
//
// CritiTrack has no relationship/associate data model yet (Step 21 in
// the roadmap). This function exists so the pipeline and UI already
// know the shape; it always returns an empty list rather than
// fabricating anything, and the RELATIONSHIP_CHANGE type stays in
// ChangeType so downstream code does not need to change when that
// system ships.
function relationshipChanges(): ChangeEvent[] {
  return [];
}

// ── Orchestration ────────────────────────────────────────────────────

const SEVERITY_RANK: Record<ChangeSeverity, number> = { INFO: 0, MINOR: 1, SIGNIFICANT: 2, MAJOR: 3 };

/**
 * Detects every meaningful change between two real snapshots of the
 * same profile. `detectedAt` should be `current.fetchedAt` — the real
 * time the new snapshot was retrieved, never `Date.now()` computed
 * inside this function (kept an explicit parameter for purity/testing).
 *
 * Returns nothing when the two snapshots may not even be the same real
 * person: a same-name slug with an "ambiguous" entity-resolution band
 * is exactly the case Entity Resolution itself refuses to pick a single
 * person for, so Change Detection must not either — comparing across
 * two different ambiguously-resolved individuals would produce entirely
 * fabricated "changes".
 */
export function detectChanges(
  previous: RealProfile,
  current: RealProfile,
  detectedAt: string,
): ChangeEvent[] {
  if (previous.slug !== current.slug) return [];
  if (current.resolution === "ambiguous" || previous.resolution === "ambiguous") return [];
  const entityId = current.slug;

  const events = [
    ...careerChanges(entityId, detectedAt, previous.career.timeline, current.career.timeline),
    ...organizationChanges(entityId, detectedAt, previous.career.organizations, current.career.organizations),
    ...professionChange(entityId, detectedAt, previous.profession, current.profession),
    ...controversyChanges(entityId, detectedAt, previous.controversies, current.controversies),
    ...claimChanges(
      entityId,
      detectedAt,
      buildClaimMatrix(
        previous.controversies,
        buildEvidenceItems({
          media: previous.media,
          controversies: previous.controversies,
          career: previous.career.timeline,
          sentimentEvidence: previous.evidence,
        }),
      ),
      buildClaimMatrix(
        current.controversies,
        buildEvidenceItems({
          media: current.media,
          controversies: current.controversies,
          career: current.career.timeline,
          sentimentEvidence: current.evidence,
        }),
      ),
    ),
    ...newsChanges(entityId, detectedAt, previous.media, current.media, current.controversies),
    ...sentimentChange(entityId, detectedAt, previous, current),
    ...attentionChange(entityId, detectedAt, previous, current),
    ...critiscoreChange(entityId, detectedAt, previous.controversies, current.controversies),
    ...profileChanges(entityId, detectedAt, previous, current),
    ...coverageChanges(entityId, detectedAt, previous, current),
    ...relationshipChanges(),
  ];

  return events.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
}

export type ChangeFilter =
  | "all"
  | "career"
  | "controversies"
  | "claims"
  | "news"
  | "sentiment"
  | "attention"
  | "score"
  | "profile";

const FILTER_TYPES: Record<Exclude<ChangeFilter, "all">, ChangeType[]> = {
  career: ["CAREER_CHANGE", "PROFESSION_CHANGE", "ORGANIZATION_CHANGE"],
  controversies: ["CONTROVERSY_CHANGE"],
  claims: ["CLAIM_CHANGE"],
  news: ["NEWS_CHANGE"],
  sentiment: ["SENTIMENT_CHANGE"],
  attention: ["ATTENTION_CHANGE"],
  score: ["CRITISCORE_CHANGE"],
  profile: ["PROFILE_CHANGE", "SOURCE_COVERAGE_CHANGE", "DATA_AVAILABILITY_CHANGE"],
};

export function filterChanges(changes: ChangeEvent[], filter: ChangeFilter): ChangeEvent[] {
  if (filter === "all") return changes;
  return changes.filter((c) => FILTER_TYPES[filter].includes(c.changeType));
}
