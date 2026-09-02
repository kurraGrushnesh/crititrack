import Link from "next/link";
import type { ControversyIndex } from "@/lib/controversy-index";
import { roundedScore } from "@/lib/controversy-index";

/**
 * The deterministic Controversy Index, shown as a ring plus its label
 * and the inputs that produced it. The number comes straight from
 * `computeControversyIndex` -- no model is involved, and the same input
 * always renders the same ring.
 */
export default function ControversyIndexGauge({
  index,
}: {
  index: ControversyIndex;
}) {
  const value = roundedScore(index);
  const radius = 53;
  const circumference = 2 * Math.PI * radius;
  const dash = (value / 100) * circumference;

  return (
    <div className="index-panel">
      <div
        className="gauge"
        role="img"
        aria-label={`Controversy Index ${value} out of 100, ${index.label}`}
      >
        <svg viewBox="0 0 116 116">
          <circle className="g-track" cx="58" cy="58" r={radius} />
          <circle
            className="g-fill"
            cx="58"
            cy="58"
            r={radius}
            strokeDasharray={`${dash} ${circumference}`}
          />
        </svg>
        <span className="g-value">{value}</span>
      </div>
      <div>
        <p className="ip-label">{index.label}</p>
        <p className="ip-meta">
          {index.total === 0
            ? "No documented controversies."
            : `${index.total} documented ${
                index.total === 1 ? "episode" : "episodes"
              }, peak severity ${index.peakSeverity}, ${
                index.ongoingCount
              } unresolved.`}
        </p>
        <p className="ip-note">
          Computed from the records below by a fixed formula. Not a model
          output.{" "}
          <Link href="/controversy-index">How this is calculated</Link>
        </p>
      </div>
    </div>
  );
}
