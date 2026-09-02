import type { TrendPoint } from "@/lib/demo-data";
import { sentimentColorVar, sentimentLabel } from "@/lib/sentiment";

const DIR_LABEL = {
  up: "trending up",
  down: "trending down",
  stable: "holding steady",
} as const;

/**
 * A small sparkline of the recorded sentiment history plus the current
 * score. The line is drawn from stored dated points, the same way the
 * app's trend chart is -- it is a query over measured history, not a
 * forecast.
 */
export default function SentimentTrend({
  points,
  current,
  direction,
}: {
  points: TrendPoint[];
  current: number;
  direction: "up" | "down" | "stable";
}) {
  const w = 120;
  const h = 40;
  const scores = points.map((p) => p.score);
  const min = Math.min(...scores) - 4;
  const max = Math.max(...scores) + 4;
  const span = Math.max(1, max - min);
  const path = points
    .map((p, i) => {
      const x = (i / Math.max(1, points.length - 1)) * w;
      const y = h - ((p.score - min) / span) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="trend">
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={`Sentiment ${sentimentLabel(current)}, ${DIR_LABEL[direction]}`}
      >
        <path
          d={path}
          fill="none"
          stroke={sentimentColorVar(current)}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div>
        <div
          className="t-current"
          style={{ color: sentimentColorVar(current) }}
        >
          {current}
        </div>
        <div className="t-dir">{DIR_LABEL[direction]}</div>
      </div>
    </div>
  );
}
