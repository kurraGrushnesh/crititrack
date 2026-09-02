"use client";

import { useRef, useState } from "react";
import type { Attention } from "@/lib/api";
import {
  attentionGeometry,
  changeLabel,
  formatCompact,
  shortDate,
} from "@/lib/attention";

/**
 * Public attention: daily Wikipedia pageviews over the trailing window.
 * Single-series area chart, inline SVG, no chart library. The peak and
 * the latest day are marked; a pointer sweep reads out any day.
 */

const W = 640;
const H = 180;

export default function AttentionChart({ data }: { data: Attention }) {
  const geo = attentionGeometry(data.series, W, H);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  if (!geo) return null;
  const { line, area, points, peakIndex, maxViews } = geo;
  const peak = points[peakIndex];
  const latest = points[points.length - 1];
  const s = data.summary;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const idx = Math.round(ratio * (points.length - 1));
    const clamped = Math.max(0, Math.min(points.length - 1, idx));
    setHover((prev) => (prev === clamped ? prev : clamped));
  }

  const active = hover != null ? points[hover] : null;

  return (
    <div className="attention">
      <div className="attention-figure">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="attention-svg"
          role="img"
          aria-label={`Wikipedia pageviews${
            s ? `, ${changeLabel(s.changePct)} over ${s.days} days, peak ${formatCompact(s.peak.views)}` : ""
          }`}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          <line
            x1="0"
            y1={H}
            x2={W}
            y2={H}
            stroke="var(--border-strong)"
            strokeWidth="1"
          />
          <path d={area} className="attention-area" />
          <path
            d={line}
            fill="none"
            stroke="var(--brand-strong)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {peakIndex !== points.length - 1 && (
            <circle cx={peak.x} cy={peak.y} r="3.5" fill="var(--brand-strong)" />
          )}
          <circle
            cx={latest.x}
            cy={latest.y}
            r="3.5"
            fill="var(--brand-strong)"
          />

          {active && (
            <g>
              <line
                x1={active.x}
                y1="0"
                x2={active.x}
                y2={H}
                stroke="var(--text-muted)"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <circle
                cx={active.x}
                cy={active.y}
                r="4"
                fill="var(--text)"
              />
            </g>
          )}
        </svg>

        {active && (
          <div
            className="attention-tip"
            style={{
              left: `${Math.min(94, Math.max(6, (active.x / W) * 100))}%`,
            }}
          >
            <b>{formatCompact(active.views)}</b> {shortDate(active.date)}
          </div>
        )}

        <div className="attention-axis">
          <span>{shortDate(points[0].date)}</span>
          <span className="attention-axis-max">
            peak {formatCompact(maxViews)}
          </span>
          <span>{shortDate(latest.date)}</span>
        </div>
      </div>

      {s && (
        <dl className="attention-stats">
          <div>
            <dt>Peak</dt>
            <dd>
              {formatCompact(s.peak.views)}
              <span className="attention-stat-sub">{shortDate(s.peak.date)}</span>
            </dd>
          </div>
          <div>
            <dt>Daily average</dt>
            <dd>{formatCompact(s.mean)}</dd>
          </div>
          <div>
            <dt>Latest</dt>
            <dd>
              {formatCompact(s.latest.views)}
              <span className="attention-stat-sub">
                {shortDate(s.latest.date)}
              </span>
            </dd>
          </div>
          <div>
            <dt>{s.days}-day change</dt>
            <dd>{changeLabel(s.changePct)}</dd>
          </div>
        </dl>
      )}

      <p className="form-note">Source: {data.source}.</p>
    </div>
  );
}
