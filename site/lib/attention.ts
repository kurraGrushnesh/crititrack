import type { AttentionPoint } from "./api";

/**
 * Geometry and formatting for the public-attention chart — daily
 * Wikipedia pageviews for a figure over the trailing window the backend
 * returns.
 *
 * The chart is a single-series area (the standard form for one metric
 * over time), so there is no colour-identity problem to solve here: one
 * hue, a light fill, the peak and the latest day marked.
 */

/** "397K", "1.6M", "940" — compact counts for axis and stat labels. */
export function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  }
  if (abs >= 1_000) {
    return `${(n / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}K`;
  }
  return String(Math.round(n));
}

/** "up 43%", "down 8%", "flat" — the trailing-window change. */
export function changeLabel(pct: number): string {
  const r = Math.round(pct);
  if (r > 0) return `up ${r}%`;
  if (r < 0) return `down ${Math.abs(r)}%`;
  return "flat";
}

/** "Jul 4" — short label for an ISO date string. */
export function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export interface GeometryPoint {
  x: number;
  y: number;
  date: string;
  views: number;
}

export interface AttentionGeometry {
  /** Polyline path for the top edge. */
  line: string;
  /** Closed path for the fill, dropped to the baseline at both ends. */
  area: string;
  points: GeometryPoint[];
  peakIndex: number;
  maxViews: number;
}

/**
 * Projects the series into an SVG box `width` x `height` (user units).
 * Points are evenly spaced on X (the series is daily and contiguous); Y
 * is linear from 0 at the baseline to `maxViews` at the top. Returns
 * `null` for a series too short to draw.
 */
export function attentionGeometry(
  series: AttentionPoint[],
  width: number,
  height: number,
): AttentionGeometry | null {
  if (series.length < 2) return null;

  const maxViews = Math.max(1, ...series.map((p) => p.views));
  const stepX = width / (series.length - 1);

  const points: GeometryPoint[] = series.map((p, i) => ({
    x: i * stepX,
    y: height - (Math.max(0, p.views) / maxViews) * height,
    date: p.date,
    views: p.views,
  }));

  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ");
  const area = `${line} L${width.toFixed(2)},${height.toFixed(2)} L0.00,${height.toFixed(2)} Z`;

  let peakIndex = 0;
  series.forEach((p, i) => {
    if (p.views > series[peakIndex].views) peakIndex = i;
  });

  return { line, area, points, peakIndex, maxViews };
}
