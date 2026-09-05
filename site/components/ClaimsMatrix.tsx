"use client";

import { useState } from "react";
import {
  CLAIM_STATUS_LABEL,
  CLAIM_TYPE_LABEL,
  METHODOLOGY_VERSION,
  claimsForControversy,
  filterClaims,
  type Claim,
  type ClaimFilter,
} from "@/lib/claims";

/**
 * The Claim Verification Matrix for one controversy record: the discrete
 * things actually claimed (an allegation was reported, someone denied
 * it, a body investigated it, a court ruled), each with its own
 * evidence-backed status. Never a truth verdict — the strongest label
 * this ever shows is "resolved by authoritative finding", and only when
 * the linked evidence is itself a court/official record.
 */

const STATUS_CLASS: Record<Claim["status"], string> = {
  supported: "is-supported",
  partially_supported: "is-partial",
  conflicting: "is-conflicting",
  reported_uncorroborated: "is-uncorroborated",
  insufficient_evidence: "is-insufficient",
  resolved_authoritative: "is-resolved",
  unknown: "is-unknown",
};

const CONFIDENCE_LABEL: Record<Claim["confidence"], string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const FILTERS: { key: ClaimFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "supported", label: "Supported" },
  { key: "conflicting", label: "Conflicting" },
  { key: "insufficient", label: "Insufficient" },
  { key: "responses", label: "Responses" },
  { key: "official_findings", label: "Official findings" },
];

function evidenceCount(c: Claim): number {
  return new Set([
    ...c.supportingEvidenceIds,
    ...c.contradictingEvidenceIds,
    ...c.neutralEvidenceIds,
    ...c.responseEvidenceIds,
  ]).size;
}

function ClaimCard({ claim }: { claim: Claim }) {
  const [open, setOpen] = useState(false);
  const n = evidenceCount(claim);
  return (
    <div className={`cv-card ${STATUS_CLASS[claim.status]}`}>
      <button
        type="button"
        className="cv-card-head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="cv-type">{CLAIM_TYPE_LABEL[claim.claimType]}</span>
        <span className="cv-text">{claim.claimText}</span>
        <span className={`cv-status ${STATUS_CLASS[claim.status]}`}>
          {CLAIM_STATUS_LABEL[claim.status]}
        </span>
      </button>
      {open && (
        <div className="cv-card-body">
          <div className="cv-meta-row">
            <span>
              Confidence: <strong>{CONFIDENCE_LABEL[claim.confidence]}</strong>
            </span>
            <span>
              Evidence: <strong>{n} source{n === 1 ? "" : "s"}</strong>
            </span>
            {claim.dateContext && <span>{claim.dateContext}</span>}
          </div>
          <p className="cv-reason">{claim.statusReason}</p>
          <div className="cv-buckets">
            {claim.supportingEvidenceIds.length > 0 && (
              <span className="cv-bucket cv-support">
                ✓ {claim.supportingEvidenceIds.length} supporting
              </span>
            )}
            {claim.contradictingEvidenceIds.length > 0 && (
              <span className="cv-bucket cv-contradict">
                ↔ {claim.contradictingEvidenceIds.length} contradicting
              </span>
            )}
            {claim.responseEvidenceIds.length > 0 && (
              <span className="cv-bucket cv-response">
                ⤷ {claim.responseEvidenceIds.length} response
              </span>
            )}
            {claim.neutralEvidenceIds.length > 0 && (
              <span className="cv-bucket cv-context">
                · {claim.neutralEvidenceIds.length} context
              </span>
            )}
          </div>
          <a href="#evidence-explorer" className="cv-evidence-link">
            View evidence →
          </a>
        </div>
      )}
    </div>
  );
}

export default function ClaimsMatrix({
  controversyTitle,
  claims,
}: {
  controversyTitle: string;
  claims: Claim[];
}) {
  const [filter, setFilter] = useState<ClaimFilter>("all");
  const all = claimsForControversy(claims, controversyTitle);
  if (all.length === 0) return null;
  const shown = filterClaims(all, filter);

  return (
    <div className="cv-matrix">
      <div className="cv-head">
        <span className="cv-label">Claims</span>
        <div className="cv-filters">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`cv-filter ${filter === f.key ? "is-active" : ""}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="cv-empty">No claims match this filter.</p>
      ) : (
        shown.map((c) => <ClaimCard key={c.claimId} claim={c} />)
      )}
      <p className="dc-footnote" style={{ marginTop: 8 }}>
        Claim verification methodology v{METHODOLOGY_VERSION}.{" "}
        <a href="/methodology#claims">How this is calculated →</a>
      </p>
    </div>
  );
}
