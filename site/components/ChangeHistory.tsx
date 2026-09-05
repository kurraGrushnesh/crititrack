"use client";

import { useState } from "react";
import {
  filterChanges,
  type ChangeEvent,
  type ChangeFilter,
  type ChangeSeverity,
} from "@/lib/changes";

const SEVERITY_CLASS: Record<ChangeSeverity, string> = {
  MAJOR: "is-major",
  SIGNIFICANT: "is-significant",
  MINOR: "is-minor",
  INFO: "is-info",
};

const FILTERS: { key: ChangeFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "career", label: "Career" },
  { key: "controversies", label: "Controversies" },
  { key: "claims", label: "Claims" },
  { key: "news", label: "News" },
  { key: "sentiment", label: "Sentiment" },
  { key: "attention", label: "Attention" },
  { key: "score", label: "Score" },
  { key: "profile", label: "Profile" },
];

function ChangeCard({ change }: { change: ChangeEvent }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rc-change ${SEVERITY_CLASS[change.severity]}`}>
      <button type="button" className="rc-change-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="rc-change-title">{change.title}</span>
        <span className={`rc-severity ${SEVERITY_CLASS[change.severity]}`}>{change.severity}</span>
      </button>
      {open && (
        <div className="rc-change-body">
          {(change.previousValue != null || change.currentValue != null) && (
            <p className="rc-before-after">
              {change.previousValue ?? "—"} → {change.currentValue ?? "—"}
            </p>
          )}
          <p className="rc-summary">{change.summary}</p>
          <div className="rc-meta-row">
            <span>Confidence: {change.confidence}</span>
            {change.sourceCoverage && <span>{change.sourceCoverage}</span>}
            {change.effectiveDate && <span>Dated: {change.effectiveDate}</span>}
          </div>
          {change.evidenceIds.length > 0 && (
            <a href="#evidence-explorer" className="cv-evidence-link">
              View evidence ({change.evidenceIds.length}) →
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default function ChangeHistory({ changes }: { changes: ChangeEvent[] }) {
  const [filter, setFilter] = useState<ChangeFilter>("all");
  const shown = filterChanges(changes, filter);

  if (changes.length === 0) {
    return (
      <p className="state-block">
        <span className="sb-title">No changes detected yet</span>
        CritiTrack compares each profile against the last version this
        browser saw. This is the first time — or nothing changed since
        last time.
      </p>
    );
  }

  return (
    <div className="rc-history">
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
      {shown.length === 0 ? (
        <p className="cv-empty">No changes match this filter.</p>
      ) : (
        shown.map((c) => <ChangeCard key={c.changeId} change={c} />)
      )}
    </div>
  );
}
