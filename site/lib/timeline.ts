/**
 * The Intelligence Timeline: every dated thing CritiTrack actually knows
 * about a figure, merged onto one spine — controversies, career and
 * organisation changes, grouped news coverage, attention spikes and
 * sentiment shifts.
 *
 * Everything here is derived from data the profile already carries
 * (`profile.controversies`, `profile.career`, `profile.media`,
 * `profile.attention`, `profile.trend`) — no new request, no model call.
 * A single article is never a timeline event on its own: `newsEvents`
 * only surfaces a day where at least two sources covered the same day,
 * grouped into one entry. `importance` is a plain read of a real signal
 * already on the event (severity, source count, view multiple, sentiment
 * delta) — never an invented score — and is always shown with the number
 * behind it, not just a label.
 */

import type { TrendPoint, MediaLink, AttentionPoint } from "./api";
import type { Controversy } from "./controversy";
import { parseSafeUrl, displayHost } from "./safe-url";

/** First formally tracked version of the timeline assembly rules below
 * (event sources, day-grouping threshold, importance signals). */
export const TIMELINE_METHODOLOGY_VERSION = "1.0";
import type { CareerEntry } from "./career";
import { LEADERSHIP } from "./career";

export type TimelineKind =
  | "controversy"
  | "attention-spike"
  | "sentiment-shift"
  | "news"
  | "career"
  | "organization";

export type Importance = "high" | "medium" | "low";

export interface TimelineSource {
  label: string;
  /** Null when the reference is a name only, not an openable link. */
  url: string | null;
}

export interface TimelineEvent {
  date: string;
  approxDate: boolean;
  kind: TimelineKind;
  title: string;
  detail: string;
  /** 1–5, controversy only. */
  severity: number | null;
  /** Signed score-point delta, sentiment-shift only. */
  change: number | null;
  /** Grouped source count, news only. */
  sourceCount: number | null;
  /** Average sentiment (0–100) of the grouped coverage, news only. */
  sentimentImpact: number | null;
  /** Raw Wikipedia view count on the spike day, attention-spike only. */
  attentionImpact: number | null;
  sources: TimelineSource[];
  importance: Importance;
  /** Names the real signal the importance rating came from. */
  importanceReason: string;
  /** Other event titles within a week — a temporal correlation, not a
   * claimed cause. */
  relatedTitles: string[];
}

/** Standard deviations above the mean for an attention day to count. */
const ATTENTION_Z = 2;
/** Score points between consecutive trend points for a shift event. */
const SHIFT_POINTS = 10;
/** Fewer sources than this and a day of coverage is not a timeline event —
 * one article is the media feed's job, not the timeline's. */
const NEWS_GROUP_MIN = 2;
/** How many days apart two events still count as "around the same time". */
const RELATED_WINDOW_DAYS = 7;

function finite(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function dayKey(iso: string | undefined | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function sourceFor(raw: string): TimelineSource {
  const url = parseSafeUrl(raw);
  return { label: url ? displayHost(raw) : raw, url: url ? raw : null };
}

// ── Controversy ──────────────────────────────────────────────────────

function controversyEvents(items: Controversy[]): TimelineEvent[] {
  return items
    .filter((c) => c.year != null)
    .map((c) => {
      const importance: Importance =
        c.severity >= 4 || c.status === "ongoing"
          ? "high"
          : c.severity >= 2
            ? "medium"
            : "low";
      return {
        date: `${c.year}-01-01`,
        approxDate: true,
        kind: "controversy" as const,
        title: c.title,
        detail: c.summary,
        severity: c.severity,
        change: null,
        sourceCount: c.sources.length || null,
        sentimentImpact: null,
        attentionImpact: null,
        sources: c.sources.map(sourceFor),
        importance,
        importanceReason: `severity ${c.severity}/5${c.status === "ongoing" ? ", unresolved" : ""}`,
        relatedTitles: [],
      };
    });
}

// ── Attention ────────────────────────────────────────────────────────

function attentionSpikeEvents(series: AttentionPoint[]): TimelineEvent[] {
  const points = (Array.isArray(series) ? series : []).filter(
    (p) => p && typeof p.date === "string" && finite(p.views) !== null,
  );
  if (points.length < 5) return [];

  const views = points.map((p) => p.views);
  const mean = views.reduce((a, b) => a + b, 0) / views.length;
  const sd = Math.sqrt(views.reduce((t, v) => t + (v - mean) ** 2, 0) / views.length);
  if (sd === 0) return [];

  return points
    .filter((p) => (p.views - mean) / sd >= ATTENTION_Z)
    .map((p) => {
      const ratio = p.views / mean;
      return {
        date: p.date,
        approxDate: false,
        kind: "attention-spike" as const,
        title: "Attention spike",
        // Deliberately unsigned: a spike has no valence.
        detail: `Wikipedia views reached ${Math.round(p.views).toLocaleString()}, about ${ratio.toFixed(1)}x the period average.`,
        severity: null,
        change: null,
        sourceCount: null,
        sentimentImpact: null,
        attentionImpact: Math.round(p.views),
        sources: [],
        importance: (ratio >= 4 ? "high" : ratio >= 2.6 ? "medium" : "low") as Importance,
        importanceReason: `${ratio.toFixed(1)}x average Wikipedia attention`,
        relatedTitles: [],
      };
    });
}

// ── Sentiment ────────────────────────────────────────────────────────

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
      detail: `${Math.abs(Math.round(delta))} points ${up ? "up" : "down"} in a day, to ${Math.round(rows[i].score)}/100.`,
      severity: null,
      change: Math.round(delta),
      sourceCount: null,
      sentimentImpact: null,
      attentionImpact: null,
      sources: [],
      importance: Math.abs(delta) >= 20 ? "high" : "medium",
      importanceReason: `${Math.abs(Math.round(delta))}-point move in one day`,
      relatedTitles: [],
    });
  }
  return out;
}

// ── News (grouped) ───────────────────────────────────────────────────

function newsEvents(media: MediaLink[]): TimelineEvent[] {
  const byDay = new Map<string, MediaLink[]>();
  for (const m of media) {
    const day = dayKey(m.publishedAt);
    if (!day) continue;
    const list = byDay.get(day) ?? [];
    list.push(m);
    byDay.set(day, list);
  }

  const out: TimelineEvent[] = [];
  for (const [day, items] of byDay) {
    // A single article is the media feed's job; the timeline only
    // surfaces a day multiple sources actually covered.
    if (items.length < NEWS_GROUP_MIN) continue;

    // No per-item relevance ranking is available, so the first item in
    // retrieval order stands in for the day's headline.
    const headline = items[0];
    const scored = items
      .map((i) => i.sentimentScore)
      .filter((s): s is number => s != null);
    const avgSentiment = scored.length
      ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length)
      : null;

    const seenUrls = new Set<string>();
    const sources = items
      .filter((i) => {
        if (seenUrls.has(i.url)) return false;
        seenUrls.add(i.url);
        return true;
      })
      .slice(0, 8)
      .map((i) => ({
        label: i.source || sourceFor(i.url).label || i.title,
        url: parseSafeUrl(i.url) ? i.url : null,
      }));

    out.push({
      date: day,
      approxDate: false,
      kind: "news",
      title: headline.title,
      detail:
        `${items.length} related source${items.length === 1 ? "" : "s"}` +
        (avgSentiment != null ? ` · average tone ${avgSentiment}/100` : ""),
      severity: null,
      change: null,
      sourceCount: items.length,
      sentimentImpact: avgSentiment,
      attentionImpact: null,
      sources,
      importance: items.length >= 6 ? "high" : items.length >= 4 ? "medium" : "low",
      importanceReason: `${items.length} corroborating sources the same day`,
      relatedTitles: [],
    });
  }
  return out;
}

// ── Career & organisation ────────────────────────────────────────────

function careerTimelineEvents(entries: CareerEntry[]): TimelineEvent[] {
  return entries
    .filter((e) => e.start != null)
    .map((e) => {
      const isOrgOnly = !e.role;
      const title = e.role
        ? [e.role, e.organization].filter(Boolean).join(", ")
        : (e.organization ?? "Career update");
      const leadership = e.role != null && LEADERSHIP.test(e.role);
      return {
        date: `${e.start}-01-01`,
        approxDate: true,
        kind: (isOrgOnly ? "organization" : "career") as TimelineKind,
        title,
        detail: [e.industry, e.location].filter(Boolean).join(" · "),
        severity: null,
        change: null,
        sourceCount: null,
        sentimentImpact: null,
        attentionImpact: null,
        sources: e.source.url ? [{ label: e.source.name, url: e.source.url }] : [],
        importance: (leadership ? "high" : e.current ? "medium" : "low") as Importance,
        importanceReason: leadership
          ? "a leadership role"
          : e.current
            ? "the current role"
            : "a recorded career step",
        relatedTitles: [],
      };
    });
}

// ── Connections ──────────────────────────────────────────────────────

/**
 * Attaches up to two nearby event titles to each event — things that
 * happened within a week, so a reader can see what else was going on
 * without the timeline asserting that one caused the other.
 */
function attachRelated(events: TimelineEvent[]): TimelineEvent[] {
  const WINDOW_MS = RELATED_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const times = events.map((e) => new Date(e.date).getTime());

  return events.map((e, i) => {
    if (Number.isNaN(times[i])) return e;
    const nearby = events
      .map((other, j) => ({ other, j, dt: Math.abs(times[j] - times[i]) }))
      .filter(({ j, dt }) => j !== i && !Number.isNaN(dt) && dt <= WINDOW_MS)
      .sort((a, b) => a.dt - b.dt)
      .slice(0, 2)
      .map(({ other }) => other.title);
    return nearby.length > 0 ? { ...e, relatedTitles: nearby } : e;
  });
}

const KIND_ORDER: Record<TimelineKind, number> = {
  controversy: 0,
  career: 1,
  organization: 2,
  news: 3,
  "attention-spike": 4,
  "sentiment-shift": 5,
};

/** Whether `dateIso` falls within the last `days` days of `now`. `days`
 * of `null` means "no limit" — always true. Takes `now` as a parameter
 * (rather than calling `Date.now()` directly at the use site) so a caller
 * inside a React render can stay a pure function of its arguments. */
export function withinRangeDays(
  dateIso: string,
  days: number | null,
  now: number = Date.now(),
): boolean {
  if (days == null) return true;
  const t = new Date(dateIso).getTime();
  if (Number.isNaN(t)) return false;
  return t >= now - days * 86_400_000;
}

/**
 * The unified, most-recent-first Intelligence Timeline. Every input is
 * data the profile already carries — no request happens here.
 */
export function buildTimeline(input: {
  controversies: Controversy[];
  media: MediaLink[];
  career: CareerEntry[];
  attentionSeries: AttentionPoint[];
  trend: TrendPoint[];
}): TimelineEvent[] {
  const merged = [
    ...controversyEvents(input.controversies ?? []),
    ...careerTimelineEvents(input.career ?? []),
    ...newsEvents(input.media ?? []),
    ...attentionSpikeEvents(input.attentionSeries ?? []),
    ...sentimentShiftEvents(input.trend ?? []),
  ].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (KIND_ORDER[a.kind] ?? 9) - (KIND_ORDER[b.kind] ?? 9);
  });

  return attachRelated(merged);
}
