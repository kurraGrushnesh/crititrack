/**
 * The Claim Verification Matrix — breaks a controversy record down into
 * the discrete things actually being claimed (an allegation was reported,
 * someone denied it, a body investigated it, an authority ruled on it)
 * and shows, for each one, exactly what evidence backs it, what evidence
 * cuts against it, and what that evidence set does and doesn't establish.
 *
 * This is a read-time derivation over the Evidence & Source Explorer's
 * output (`EvidenceItem[]` from `evidence.ts`) and the existing
 * controversy records — nothing here is fetched, stored, or generated
 * separately, and no model decides a claim's status. Every claim traces
 * to real evidence already retrieved and corroborated by the existing
 * gate in `controversy.ts`; when nothing was retrieved, the claim says so
 * rather than being invented or padded.
 *
 * "Status" is never a truth verdict. The strongest label this module
 * ever produces is "resolved by authoritative finding", and only when
 * the linked evidence itself is a court/official record reporting a
 * ruling — CritiTrack still just reports what the record says, it never
 * decides guilt or innocence itself.
 */

import type { EvidenceItem } from "./evidence";
import type { Controversy } from "./controversy";

export type ClaimType =
  | "allegation"
  | "reported_event"
  | "statement"
  | "denial"
  | "response"
  | "legal_finding"
  | "official_finding"
  | "career_claim"
  | "other";

export const CLAIM_TYPE_LABEL: Record<ClaimType, string> = {
  allegation: "Allegation",
  reported_event: "Reported event",
  statement: "Statement",
  denial: "Denial",
  response: "Response",
  legal_finding: "Legal finding",
  official_finding: "Official finding",
  career_claim: "Career / professional claim",
  other: "Other",
};

export type ClaimStatus =
  | "supported"
  | "partially_supported"
  | "conflicting"
  | "reported_uncorroborated"
  | "insufficient_evidence"
  | "resolved_authoritative"
  | "unknown";

export const CLAIM_STATUS_LABEL: Record<ClaimStatus, string> = {
  supported: "Supported by available evidence",
  partially_supported: "Partially supported",
  conflicting: "Conflicting evidence",
  reported_uncorroborated: "Reported / not independently corroborated",
  insufficient_evidence: "Insufficient evidence",
  resolved_authoritative: "Resolved by authoritative finding",
  unknown: "Unknown",
};

export type ClaimConfidence = "high" | "medium" | "low";

export interface Claim {
  claimId: string;
  entityId: string | null;
  controversyId: string;
  timelineEventId: string | null;
  claimText: string;
  claimType: ClaimType;
  /** Best available date/context string — from the linked evidence's own
   * publication date when there is one, else the controversy's year. */
  dateContext: string | null;
  status: ClaimStatus;
  confidence: ClaimConfidence;
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
  neutralEvidenceIds: string[];
  responseEvidenceIds: string[];
  /** Derived from the linked evidence's own dates, not a wall-clock
   * timestamp — claims are not persisted, so there is no real "created"
   * moment to record; this is "earliest evidence found". */
  createdAt: string | null;
  /** "Most recent evidence found" — same caveat as {@link createdAt}. */
  updatedAt: string | null;
  methodologyVersion: string;
  /** Short, deterministic "why this status" line, built only from the
   * counts above — never a free-text model explanation. */
  statusReason: string;
}

export const METHODOLOGY_VERSION = "cvm-1";

// ── Deterministic text classifiers ──────────────────────────────────
//
// These are plain keyword/regex checks over real, already-retrieved
// headlines and summaries — not model inference. They only ever route an
// existing piece of evidence into a bucket; they never author claim text
// or invent that an event happened.

const RESPONSE_RE =
  /\b(den(y|ies|ied|ying)|spokesperson|representative (said|stated)|responds?|responded|responding|issued a statement|declined to comment)\b/i;

const CONTRADICT_RE =
  /\b(clears?|cleared|dismiss(es|ed)?|charges?\s+(were\s+)?dropped|drop(s|ped)?\s+(the\s+)?(charges|case|lawsuit)|no evidence|unfounded|debunked|retracts?|retracted)\b/i;

const RESOLUTION_RE =
  /\b(convicted|conviction|acquitted|acquittal|sentenced|verdict|ruled|ruling|guilty plea|liable|found (in favor|against)|ordered to pay|settlement (reached|announced)|settled the)\b/i;

const FINDING_RE = /\b(court|judge|jury|tribunal)\b/i;

const INVESTIGATION_RE = /\b(investigat\w*|probe|inquiry)\b/i;

const ALLEGATION_RE = /\b(alleg\w*|accus\w*|claims?\s+(that|of))\b/i;

function textOf(e: EvidenceItem): string {
  return `${e.title} ${e.snippet ?? ""}`;
}

/** Rank used to compare {@link EvidenceStrength} values without importing
 * a separate ordering table into every call site. */
const STRENGTH_RANK: Record<string, number> = {
  strong: 3,
  moderate: 2,
  limited: 1,
  conflicting: 0,
  insufficient: -1,
};

function strongestOf(items: EvidenceItem[]): string | null {
  if (items.length === 0) return null;
  return items.reduce((best, e) =>
    STRENGTH_RANK[e.evidenceStrength] > STRENGTH_RANK[best.evidenceStrength] ? e : best,
  ).evidenceStrength;
}

function dateSpan(items: EvidenceItem[]): { earliest: string | null; latest: string | null } {
  const dates = items.map((e) => e.publicationDate).filter((d): d is string => !!d).sort();
  return { earliest: dates[0] ?? null, latest: dates[dates.length - 1] ?? null };
}

function statusFor(
  supports: EvidenceItem[],
  contradicts: EvidenceItem[],
  neutral: EvidenceItem[],
): { status: ClaimStatus; confidence: ClaimConfidence; reason: string } {
  if (supports.length === 0 && contradicts.length === 0 && neutral.length === 0) {
    return {
      status: "insufficient_evidence",
      confidence: "low",
      reason: "No supporting evidence currently available.",
    };
  }
  if (contradicts.length > 0 && supports.length > 0) {
    return {
      status: "conflicting",
      confidence: "medium",
      reason:
        `${supports.length} source${supports.length === 1 ? "" : "s"} report the event, while ` +
        `${contradicts.length} identified source${contradicts.length === 1 ? "" : "s"} dispute it — the evidence is conflicting.`,
    };
  }
  if (contradicts.length > 0) {
    return {
      status: "conflicting",
      confidence: "medium",
      reason: "The only evidence linked to this claim disputes it; no independent report corroborates it.",
    };
  }
  const best = strongestOf(supports);
  if (best === "strong") {
    return {
      status: "supported",
      confidence: "high",
      reason: `${supports.length} independently reporting sources support this claim.`,
    };
  }
  if (best === "moderate") {
    return {
      status: "supported",
      confidence: "medium",
      reason: "Two independent publishers reported this claim.",
    };
  }
  if (best === "limited" && neutral.length > 0) {
    return {
      status: "partially_supported",
      confidence: "low",
      reason: "A single source reports this directly, with additional background context available.",
    };
  }
  if (best === "limited") {
    return {
      status: "reported_uncorroborated",
      confidence: "low",
      reason: "Reported by a limited source set; independent corroboration not available.",
    };
  }
  return {
    status: "insufficient_evidence",
    confidence: "low",
    reason: "No supporting evidence currently available.",
  };
}

export function titleSlug(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Builds the Claim Verification Matrix for one controversy. Always
 * returns at least the base "reported event" claim (even if it has no
 * evidence — status then reads "insufficient evidence" rather than the
 * claim being omitted, so the UI can be honest about the gap). Denial,
 * response, and official-finding claims are only added when a linked
 * evidence item's own text actually contains that signal.
 */
export function buildClaimsForControversy(
  controversy: Controversy,
  linkedEvidence: EvidenceItem[],
  entityId: string | null = null,
): Claim[] {
  const controversyId = titleSlug(controversy.title);
  const claims: Claim[] = [];

  const findingItems = linkedEvidence.filter((e) => FINDING_RE.test(textOf(e)) || RESOLUTION_RE.test(textOf(e)));
  const responseItems = linkedEvidence.filter(
    (e) => RESPONSE_RE.test(textOf(e)) && !findingItems.includes(e),
  );
  const contradictItems = linkedEvidence.filter(
    (e) => CONTRADICT_RE.test(textOf(e)) && !findingItems.includes(e),
  );
  const investigationItems = linkedEvidence.filter(
    (e) =>
      INVESTIGATION_RE.test(textOf(e)) &&
      !findingItems.includes(e) &&
      !responseItems.includes(e) &&
      !contradictItems.includes(e),
  );
  const baseSupportItems = linkedEvidence.filter(
    (e) =>
      !findingItems.includes(e) &&
      !responseItems.includes(e) &&
      !contradictItems.includes(e) &&
      !investigationItems.includes(e),
  );

  // ── Base claim: the reported allegation/event itself ────────────────
  {
    const { status, confidence, reason } = statusFor(baseSupportItems, contradictItems, [
      ...findingItems,
      ...investigationItems,
    ]);
    const span = dateSpan(linkedEvidence);
    const claimType: ClaimType = ALLEGATION_RE.test(controversy.title + " " + controversy.summary)
      ? "allegation"
      : "reported_event";
    claims.push({
      claimId: `${controversyId}-base`,
      entityId,
      controversyId,
      timelineEventId: null,
      claimText: controversy.summary || controversy.title,
      claimType,
      dateContext: span.latest ?? (controversy.year != null ? `${controversy.year}` : null),
      status,
      confidence,
      supportingEvidenceIds: baseSupportItems.map((e) => e.evidenceId),
      contradictingEvidenceIds: contradictItems.map((e) => e.evidenceId),
      neutralEvidenceIds: [...findingItems, ...investigationItems].map((e) => e.evidenceId),
      responseEvidenceIds: responseItems.map((e) => e.evidenceId),
      createdAt: span.earliest,
      updatedAt: span.latest,
      methodologyVersion: METHODOLOGY_VERSION,
      statusReason: reason,
    });
  }

  // ── Response / denial claims — one per distinct responding item ─────
  responseItems.forEach((e, i) => {
    const independent = e.independentSourceCount ?? 1;
    const strong = independent >= 2;
    const isDenial = /\bden(y|ies|ied|ying)\b/i.test(textOf(e));
    claims.push({
      claimId: `${controversyId}-response-${i}`,
      entityId,
      controversyId,
      timelineEventId: null,
      claimText: e.title,
      claimType: isDenial ? "denial" : "response",
      dateContext: e.publicationDate,
      status: strong ? "supported" : "reported_uncorroborated",
      confidence: strong ? "medium" : "low",
      supportingEvidenceIds: [e.evidenceId],
      contradictingEvidenceIds: [],
      neutralEvidenceIds: [],
      responseEvidenceIds: [e.evidenceId],
      createdAt: e.publicationDate,
      updatedAt: e.publicationDate,
      methodologyVersion: METHODOLOGY_VERSION,
      statusReason: strong
        ? "Multiple independent sources report this response."
        : "Reported by a limited source set; independent corroboration not available.",
    });
  });

  // ── Investigation claims (opened, outcome not yet known) ────────────
  investigationItems.forEach((e, i) => {
    const independent = e.independentSourceCount ?? 1;
    claims.push({
      claimId: `${controversyId}-investigation-${i}`,
      entityId,
      controversyId,
      timelineEventId: null,
      claimText: e.title,
      claimType: "official_finding",
      dateContext: e.publicationDate,
      status: independent >= 2 ? "partially_supported" : "reported_uncorroborated",
      confidence: independent >= 2 ? "medium" : "low",
      supportingEvidenceIds: [e.evidenceId],
      contradictingEvidenceIds: [],
      neutralEvidenceIds: [],
      responseEvidenceIds: [],
      createdAt: e.publicationDate,
      updatedAt: e.publicationDate,
      methodologyVersion: METHODOLOGY_VERSION,
      statusReason:
        independent >= 2
          ? "Multiple independent sources report that this was investigated; no outcome is recorded."
          : "Reported by a limited source set; independent corroboration not available.",
    });
  });

  // ── Legal / official finding claims ──────────────────────────────────
  findingItems.forEach((e, i) => {
    const text = textOf(e);
    const isCourt = FINDING_RE.test(text);
    const resolved = RESOLUTION_RE.test(text) && (e.sourceType === "government" || isCourt);
    claims.push({
      claimId: `${controversyId}-finding-${i}`,
      entityId,
      controversyId,
      timelineEventId: null,
      claimText: e.title,
      claimType: isCourt ? "legal_finding" : "official_finding",
      dateContext: e.publicationDate,
      status: resolved ? "resolved_authoritative" : "reported_uncorroborated",
      confidence: resolved ? "high" : "low",
      supportingEvidenceIds: [e.evidenceId],
      contradictingEvidenceIds: [],
      neutralEvidenceIds: [],
      responseEvidenceIds: [],
      createdAt: e.publicationDate,
      updatedAt: e.publicationDate,
      methodologyVersion: METHODOLOGY_VERSION,
      statusReason: resolved
        ? "A court or official record reports a finding; CritiTrack states the finding as reported, not as its own judgment."
        : "A finding was reported but the source is not itself an authoritative record.",
    });
  });

  return claims;
}

/** Builds the matrix for every corroborated controversy on a profile.
 * Controversies with no linked evidence still get a base claim, so the
 * UI can say "insufficient evidence" honestly rather than hiding it. */
export function buildClaimMatrix(
  controversies: Controversy[],
  evidenceItems: EvidenceItem[],
  entityId: string | null = null,
): Claim[] {
  return controversies.flatMap((c) => {
    const linked = evidenceItems.filter((e) => e.relatedControversies.includes(c.title));
    return buildClaimsForControversy(c, linked, entityId);
  });
}

export function claimsForControversy(claims: Claim[], controversyTitle: string): Claim[] {
  const id = titleSlug(controversyTitle);
  return claims.filter((c) => c.controversyId === id);
}

export type ClaimFilter =
  | "all"
  | "supported"
  | "conflicting"
  | "insufficient"
  | "responses"
  | "official_findings";

export function filterClaims(claims: Claim[], filter: ClaimFilter): Claim[] {
  switch (filter) {
    case "all":
      return claims;
    case "supported":
      return claims.filter((c) => c.status === "supported" || c.status === "resolved_authoritative");
    case "conflicting":
      return claims.filter((c) => c.status === "conflicting");
    case "insufficient":
      return claims.filter(
        (c) => c.status === "insufficient_evidence" || c.status === "reported_uncorroborated",
      );
    case "responses":
      return claims.filter((c) => c.claimType === "denial" || c.claimType === "response");
    case "official_findings":
      return claims.filter((c) => c.claimType === "legal_finding" || c.claimType === "official_finding");
  }
}
