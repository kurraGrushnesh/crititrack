import { sentimentColorVar } from "@/lib/sentiment";

export interface ScorePart {
  label: string;
  /** 0..100, or null when that source produced nothing. */
  value: number | null;
}

/**
 * Per-source sentiment breakdown. The overall score is a reach-weighted
 * blend of these; showing the parts is what makes the blend inspectable
 * rather than asserted.
 */
export default function ScoreBreakdown({
  overall,
  parts,
}: {
  overall: number;
  parts: ScorePart[];
}) {
  const shown = parts.filter((p) => p.value != null) as {
    label: string;
    value: number;
  }[];

  return (
    <div className="breakdown">
      <div className="b-row">
        <span className="b-name">
          <b>Overall</b>
        </span>
        <span className="b-track">
          <span
            className="b-fill"
            style={{
              width: `${overall}%`,
              background: sentimentColorVar(overall),
            }}
          />
        </span>
        <span className="b-val">{Math.round(overall)}</span>
      </div>
      {shown.length === 0 ? (
        <p className="fine">No per-source scores were recorded for this profile.</p>
      ) : (
        shown.map((p) => (
          <div className="b-row" key={p.label}>
            <span className="b-name">{p.label}</span>
            <span className="b-track">
              <span className="b-fill" style={{ width: `${p.value}%` }} />
            </span>
            <span className="b-val">{Math.round(p.value)}</span>
          </div>
        ))
      )}
    </div>
  );
}
