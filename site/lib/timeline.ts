/**
 * The figure timeline: the backend sends dated controversy and
 * attention-spike events; this module parses them and folds in
 * sentiment-shift events computed from the trend series the page already
 * holds, so the merge does not need a second request.
 *
 * Every event names its source. Nothing here asserts anything the
 * profile's own sections do not — an attention spike is unsigned, a
 * sentiment shift is a movement in the measured score, a controversy is a
 * record that already cites a source.
 */

import type { TrendPoint } from "./api";

export type TimelineKind =
  | "controversy"
  | "attention-spike"
  | "sentiment-shift";

export interface TimelineEvent {
  date: string;
  approxDate: boolean;
  kind: TimelineKind;
  title: string;
  detail: string;
  severity: number | null;
  change: number | null;
}

/** Score points between consecutive trend points for a shift event. */
const SHIFT_POINTS = 10;

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}
function finite(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

const KIND_ORDER: Record<string, number> = {
  controversy: 0,
  "attention-spike": 1,
  "sentiment-shift": 2,
};

/** Parses one backend event; returns null if it has no valid date/kind. */
export function parseTimelineEvent(v: unknown): TimelineEvent | null {
  if (!isRecord(v)) return null;
  const date = str(v.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const kind = v.kind;
  if (
    kind !== "controversy" &&
    kind !== "attention-spike" &&
    kind !== "sentiment-shift"
  ) {
    return null;
  }
  return {
    date,
    approxDate: v.approxDate === true,
    kind,
    title: str(v.title) || "Event",
    detail: str(v.detail),
    severity: finite(v.severity),
    change: finite(v.change),
  };
}

/** Sentiment-shift events derived from the trend series, oldest first. */
export function sentimentShiftEvents(trend: TrendPoint[]): TimelineEvent[] {
  const rows = (Array.isArray(trend) ? trend : []).filter(
    (p) => p && typeof p.date === "string" && finite(p.score) !== null,
  );
  const out: TimelineEvent[] = [];
  for (let i = 1; i < rows.length; i++) {
    const delta = rows[i].score - rows[i - 1].score;
    if (Math.abs(delta) < SHIFT_POINTS) continue;
    const up = delta > 0;
    out.push({
      date: rows[i].date,
      approxDate: false,
      kind: "sentiment-shift",
      title: `Sentiment ${up ? "rose" : "fell"} sharply`,
      detail: `${Math.abs(Math.round(delta))} points ${
        up ? "up" : "down"
      } in a day, to ${Math.round(rows[i].score)}/100.`,
      severity: null,
      change: Math.round(delta),
    });
  }
  return out;
}

/**
 * The merged timeline, most recent first. `raw` is `profile.timeline`
 * from the backend; `trend` is `profile.trend`.
 */
export function buildTimeline(raw: unknown, trend: TrendPoint[]): TimelineEvent[] {
  const fromBackend = (Array.isArray(raw) ? raw : [])
    .map(parseTimelineEvent)
    .filter((e): e is TimelineEvent => e !== null);

  return [...fromBackend, ...sentimentShiftEvents(trend)].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (KIND_ORDER[a.kind] ?? 9) - (KIND_ORDER[b.kind] ?? 9);
  });
}
