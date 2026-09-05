"use client";

import { useState } from "react";
import {
  DATA_STATUS_LABEL,
  type CoverageDimension,
  type CoverageLevel,
  type CoverageReport,
} from "@/lib/coverage";

const LEVEL_CLASS: Record<CoverageLevel, string> = {
  high: "is-high",
  medium: "is-medium",
  low: "is-low",
  insufficient: "is-insufficient",
  unavailable: "is-unavailable",
};

/** Sources CritiTrack can draw from — shown as a fixed transparency
 * list, each row tied to whether *this* profile actually got data from
 * it (derived from the same dimensions, not a separate fetch). */
const SOURCE_DIMENSIONS: { label: string; key: CoverageDimension["key"] }[] = [
  { label: "Wikidata", key: "identity" },
  { label: "Wikipedia", key: "wikipedia" },
  { label: "NewsAPI / GDELT", key: "news" },
  { label: "YouTube", key: "youtube" },
  { label: "Reddit", key: "reddit" },
  { label: "Wikipedia pageviews (Attention)", key: "attention" },
];

function DimensionRow({ d }: { d: CoverageDimension }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`dc-dim ${LEVEL_CLASS[d.level]}`}>
      <button
        type="button"
        className="dc-dim-head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="dc-dim-label">{d.label}</span>
        <span className={`dc-pill ${LEVEL_CLASS[d.level]}`}>{d.level.toUpperCase()}</span>
      </button>
      {open && (
        <div className="dc-dim-body">
          <span className="dc-dim-status">{DATA_STATUS_LABEL[d.status]}</span>
          <ul className="dc-reasons">
            {d.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
          {d.timeRange && (d.timeRange.earliest || d.timeRange.latest) && (
            <p className="dc-timerange">
              Coverage: {d.timeRange.earliest ?? "—"} – {d.timeRange.latest ?? "—"}
              {d.timeRange.gapNote && (
                <span className="dc-gap"> · known gap: {d.timeRange.gapNote}</span>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Only the limitations that are actually detected from the computed
 * dimensions — never a fixed boilerplate list. */
function detectLimitations(report: CoverageReport): string[] {
  const out: string[] = [];
  const byKey = new Map(report.dimensions.map((d) => [d.key, d]));
  const historical = byKey.get("historical");
  if (historical && (historical.level === "low" || historical.level === "unavailable")) {
    out.push("Historical coverage is limited.");
  }
  const unavailable = report.dimensions.filter((d) => d.level === "unavailable");
  if (unavailable.length > 0) {
    out.push(
      `${unavailable.length} source${unavailable.length === 1 ? " was" : "s were"} unavailable: ${unavailable
        .map((d) => d.label)
        .join(", ")}.`,
    );
  }
  const conflicting = report.dimensions.filter((d) => d.status === "conflicting");
  if (conflicting.length > 0) {
    out.push(
      `${conflicting.map((d) => d.label).join(", ")} ${conflicting.length === 1 ? "has" : "have"} conflicting signals.`,
    );
  }
  return out;
}

export default function DataCoverageDetail({
  report,
  freshness,
}: {
  report: CoverageReport;
  freshness?: { label: string; value: string }[];
}) {
  const limitations = detectLimitations(report);
  return (
    <div className="dc-detail">
      <div className="dc-dims">
        {report.dimensions.map((d) => (
          <DimensionRow key={d.key} d={d} />
        ))}
      </div>

      <div className="dc-sources">
        <h4>Data sources</h4>
        <ul className="dc-source-list">
          {SOURCE_DIMENSIONS.map(({ label, key }) => {
            const d = report.dimensions.find((x) => x.key === key);
            const available = !!d && d.level !== "unavailable";
            return (
              <li key={key} className={available ? "is-available" : "is-unavailable"}>
                <span aria-hidden="true">{available ? "✓" : "✕"}</span> {label}
                {!available && <span className="dc-source-note"> — unavailable</span>}
              </li>
            );
          })}
        </ul>
      </div>

      {freshness && freshness.length > 0 && (
        <div className="dc-freshness">
          <h4>Freshness</h4>
          <ul>
            {freshness.map((f) => (
              <li key={f.label}>
                <span className="dc-fresh-label">{f.label}</span> {f.value}
              </li>
            ))}
          </ul>
        </div>
      )}

      {limitations.length > 0 && (
        <div className="dc-limitations">
          <h4>Limitations</h4>
          <ul>
            {limitations.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="dc-footnote">
        Coverage measures how much usable data exists — it is separate from
        CritiScore, from sentiment, and from popularity. Methodology{" "}
        {report.coverageVersion}.{" "}
        <a href="/methodology#data-coverage">How coverage is measured →</a>
      </p>
    </div>
  );
}
