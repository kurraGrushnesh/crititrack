import type { CoverageDimension, CoverageLevel } from "@/lib/coverage";

/**
 * The compact "Data Coverage" summary card — a handful of dimensions,
 * their level, and a link to the full detail. Deliberately not the
 * dominant element of the profile: no single combined score, just a
 * short list of real, already-computed levels.
 */

const LEVEL_CLASS: Record<CoverageLevel, string> = {
  high: "is-high",
  medium: "is-medium",
  low: "is-low",
  insufficient: "is-insufficient",
  unavailable: "is-unavailable",
};

export default function DataCoverageCard({
  dimensions,
}: {
  dimensions: CoverageDimension[];
}) {
  if (dimensions.length === 0) return null;
  return (
    <div className="dc-card">
      <div className="dc-card-title">Data Coverage</div>
      <ul className="dc-card-list">
        {dimensions.map((d) => (
          <li key={d.key} className="dc-card-row">
            <span className="dc-card-label">{d.label}</span>
            <span className={`dc-pill ${LEVEL_CLASS[d.level]}`}>
              {d.level.toUpperCase()}
            </span>
          </li>
        ))}
      </ul>
      <a href="#data-coverage" className="dc-card-link">
        View data coverage →
      </a>
    </div>
  );
}
