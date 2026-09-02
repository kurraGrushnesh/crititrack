import { sentimentComposition } from "@/lib/sentiment";

/**
 * The make-up of recent coverage: what share of the sampled mentions
 * read positive, neutral, or negative. A donut for the composition, with
 * every slice directly labelled in the legend so colour never has to
 * carry identity on its own (the positive/negative hues are a known
 * colour-vision hazard).
 *
 * Pure inline SVG — no chart library. One ring, drawn with
 * stroke-dasharray; the centre shows the sample size.
 */

const R = 44;
const SW = 16;
const C = 2 * Math.PI * R;
/** Visual gap between slices, as a share of the circumference. */
const GAP = 0.014;

export default function SentimentDonut({
  positive,
  neutral,
  negative,
  sampleSize,
}: {
  positive: number;
  neutral: number;
  negative: number;
  sampleSize: number | null;
}) {
  const { slices, total } = sentimentComposition({
    positive,
    neutral,
    negative,
  });
  if (total === 0) return null;

  const drawn = slices.filter((s) => s.count > 0);
  const gap = drawn.length > 1 ? GAP : 0;
  const centre = sampleSize ?? total;

  const arcs = drawn.map((s, i) => {
    const start = drawn
      .slice(0, i)
      .reduce((sum, prev) => sum + prev.fraction, 0);
    const dash = Math.max(0.0001, (s.fraction - gap) * C);
    return {
      key: s.key,
      color: s.colorVar,
      dasharray: `${dash} ${C - dash}`,
      dashoffset: -(start + gap / 2) * C,
    };
  });

  return (
    <div className="donut">
      <div className="donut-figure">
        <svg viewBox="0 0 120 120" role="img" aria-label={ariaLabel(slices)}>
          <g transform="rotate(-90 60 60)">
            <circle
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke="var(--border)"
              strokeWidth={SW}
            />
            {arcs.map((a) => (
              <circle
                key={a.key}
                cx="60"
                cy="60"
                r={R}
                fill="none"
                stroke={a.color}
                strokeWidth={SW}
                strokeLinecap="butt"
                strokeDasharray={a.dasharray}
                strokeDashoffset={a.dashoffset}
              />
            ))}
          </g>
        </svg>
        <div className="donut-centre">
          <span className="donut-value">{centre}</span>
          <span className="donut-unit">
            {centre === 1 ? "mention" : "mentions"}
          </span>
        </div>
      </div>

      <ul className="donut-legend">
        {slices.map((s) => (
          <li key={s.key}>
            <span
              className="donut-swatch"
              style={{ background: s.colorVar }}
              aria-hidden="true"
            />
            <span className="donut-legend-label">{s.label}</span>
            <span className="donut-legend-value">
              {s.count}
              <span className="donut-legend-pct">
                {total > 0 ? ` · ${Math.round(s.fraction * 100)}%` : ""}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ariaLabel(
  slices: ReturnType<typeof sentimentComposition>["slices"],
): string {
  const parts = slices
    .filter((s) => s.count > 0)
    .map((s) => `${s.label} ${Math.round(s.fraction * 100)}%`);
  return `Coverage sentiment: ${parts.join(", ")}`;
}
