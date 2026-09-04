import Link from "next/link";
import type { Controversy } from "@/lib/controversy";
import type { ControversyIndex } from "@/lib/controversy-index";
import {
  roundedScore,
  scoreBand,
  indexConfidence,
  indexChange,
} from "@/lib/controversy-index";

const BAND_TONE: Record<string, string> = {
  "Very Low": "band-verylow",
  Low: "band-low",
  Moderate: "band-moderate",
  High: "band-high",
  "Very High": "band-veryhigh",
};

/**
 * The deterministic Controversy Index (CritiScore), shown as a ring plus
 * its label, a standardised band (for comparing figures on a common
 * scale), a data-coverage confidence line, and — only when the episodes
 * themselves carry enough dated history — a real change-over-time line.
 * The number comes straight from `computeControversyIndex`; nothing here
 * is a model output or a stored snapshot.
 *
 * `controversies` is optional so the methodology page (which has no
 * profile to compute confidence/change from) can still render the ring.
 */
export default function ControversyIndexGauge({
  index,
  controversies,
}: {
  index: ControversyIndex;
  controversies?: Controversy[];
}) {
  const value = roundedScore(index);
  const radius = 53;
  const circumference = 2 * Math.PI * radius;
  const dash = (value / 100) * circumference;
  const band = scoreBand(index.score);
  const confidence = controversies ? indexConfidence(controversies) : null;
  const change = controversies ? indexChange(controversies) : null;

  return (
    <div className="index-panel">
      <div
        className="gauge"
        role="img"
        aria-label={`Controversy Index ${value} out of 100, ${band.band}, ${index.label}`}
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
        <div className="ip-headline">
          <span className={`ip-band ${BAND_TONE[band.band]}`}>{band.band}</span>
          <p className="ip-label">{index.label}</p>
        </div>

        {change && (
          <p className="ip-change">
            {Math.round(change.previous)} → {Math.round(change.current)}{" "}
            <span className={change.delta >= 0 ? "is-up" : "is-down"}>
              {change.delta >= 0 ? "+" : ""}
              {Math.round(change.delta)}
            </span>{" "}
            since {change.previousYear}
            <span className="ip-change-caveat">
              {" "}
              — reconstructed from dated episodes, not a tracked snapshot
            </span>
          </p>
        )}

        <p className="ip-meta">
          {index.total === 0
            ? "No documented controversies."
            : `${index.total} documented ${
                index.total === 1 ? "episode" : "episodes"
              }, peak severity ${index.peakSeverity}, ${
                index.ongoingCount
              } unresolved.`}
        </p>

        {confidence && (
          <p className="ip-confidence">
            Data coverage: <strong>{confidence.level}</strong> ({confidence.reason})
          </p>
        )}

        <p className="ip-note">
          Computed from the records below by a fixed formula. Not a model
          output.{" "}
          <Link href="/controversy-index">How this is calculated</Link>
        </p>
        <p className="ip-vs-sentiment">
          This is not Public Sentiment. CritiScore is a fixed calculation
          over documented episodes; sentiment below reflects the tone of
          current coverage and can move independently.
        </p>
      </div>
    </div>
  );
}
