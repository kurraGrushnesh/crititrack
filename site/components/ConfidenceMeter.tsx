/**
 * Confidence band for a score. Confidence is `0.5*agreement +
 * 0.3*sample + 0.2*coverage` in the backend ensemble; here we render
 * whatever 0..1 value the API returned, with a plain-language label.
 */
export function confidenceLabel(v: number): string {
  if (v >= 0.75) return "High";
  if (v >= 0.5) return "Moderate";
  if (v >= 0.3) return "Low";
  return "Very low";
}

export default function ConfidenceMeter({
  value,
  caption = "How much the three scoring methods agreed",
}: {
  /** 0..1 */
  value: number;
  caption?: string;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="confidence">
      <div className="c-row">
        <span className="c-label">Confidence</span>
        <span>
          <b>{confidenceLabel(value)}</b> &middot; {pct}%
        </span>
      </div>
      <div
        className="c-track"
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Score confidence"
      >
        <div className="c-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="fine">{caption}</p>
    </div>
  );
}
