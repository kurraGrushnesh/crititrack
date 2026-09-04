"use client";

/**
 * The real backend, called from the web the same way the app calls it:
 * `GET /getCelebrity?name=` with a Firebase ID token and an App Check
 * token. Returns the profile shape the page components render.
 *
 * The mapper captures every block the page uses — `biography`,
 * `sentiment`, `attention`, `media` — plus `entity.candidates` for
 * name disambiguation. `entity.facts` (the Wikidata classification) is
 * intentionally not read: that section was removed.
 */

import { getAuthedHeaders } from "./firebase";
import {
  parseControversy,
  corroborated,
  type Controversy,
} from "./controversy";
import { buildTimeline, type TimelineEvent } from "./timeline";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "https://crititrack-api.onrender.com";

export interface EvidenceFragment {
  fragment: string;
  source: string;
}
export interface TrendPoint {
  date: string;
  score: number;
  mentions: number;
}
export interface MediaLink {
  id: string;
  title: string;
  url: string;
  source: string;
  type: string;
  /** Channel name for a video; absent for articles. */
  channel?: string;
  publishedAt?: string;
  description?: string;
  thumbnailUrl?: string;
  sentimentScore: number | null;
  sentimentTag?: string;
  /** Coarse topic of the headline: legal, financial, political, ... */
  topic?: MediaTopic;
  /** Wayback "latest capture" link, so the source survives link rot. */
  archiveUrl?: string;
}

export type MediaTopic =
  | "legal"
  | "financial"
  | "political"
  | "personal"
  | "professional"
  | "other";

const MEDIA_TOPICS: readonly MediaTopic[] = [
  "legal",
  "financial",
  "political",
  "personal",
  "professional",
  "other",
];

function topic(v: unknown): MediaTopic | undefined {
  return typeof v === "string" && (MEDIA_TOPICS as readonly string[]).includes(v)
    ? (v as MediaTopic)
    : undefined;
}

/** Filters a media list to one topic; `"all"` passes everything through. */
export function filterMediaByTopic(
  media: MediaLink[],
  selected: MediaTopic | "all",
): MediaLink[] {
  if (selected === "all") return media;
  return media.filter((m) => (m.topic ?? "other") === selected);
}

/** The topics actually present in a media list, in canonical order. */
export function topicsPresent(media: MediaLink[]): MediaTopic[] {
  const seen = new Set(media.map((m) => m.topic ?? "other"));
  return MEDIA_TOPICS.filter((t) => seen.has(t));
}

/**
 * A verified link to something the figure runs themselves — an official
 * site, a primary social account, an IMDb page. The handle is read off
 * Wikidata; the URL shape and per-platform validation are the backend's
 * (`functions/lib/entity.js`). Shown so a reader can leave and check.
 */
export interface ProfileAccount {
  /** Stable key: "x", "instagram", "youtube", "website", "imdb", … */
  platform: string;
  /** Human label for the link. */
  label: string;
  url: string;
}

/** Display order and labels for the account links. */
const ACCOUNT_META: { key: string; label: string }[] = [
  { key: "website", label: "Official site" },
  { key: "x", label: "X" },
  { key: "instagram", label: "Instagram" },
  { key: "youtube", label: "YouTube" },
  { key: "tiktok", label: "TikTok" },
  { key: "facebook", label: "Facebook" },
  { key: "threads", label: "Threads" },
  { key: "bluesky", label: "Bluesky" },
  { key: "mastodon", label: "Mastodon" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "imdb", label: "IMDb" },
];

export function mapAccounts(v: unknown): ProfileAccount[] {
  const links = obj(v);
  const out: ProfileAccount[] = [];
  for (const { key, label } of ACCOUNT_META) {
    const url = str(links[key]);
    // Only http(s); the backend already validates, this is defence in depth.
    if (url && /^https:\/\//i.test(url)) out.push({ platform: key, label, url });
  }
  return out;
}

export interface AttentionPoint {
  date: string;
  views: number;
}
export interface AttentionSummary {
  days: number;
  total: number;
  mean: number;
  median: number;
  peak: AttentionPoint;
  latest: AttentionPoint;
  changePct: number;
}
export interface Attention {
  source: string;
  series: AttentionPoint[];
  summary: AttentionSummary | null;
}

export interface RealProfile {
  slug: string;
  name: string;
  verified: boolean;
  wikidataId?: string;
  imageUrl?: string;
  imageSource?: string;

  profession: string;
  summary: string;
  background: string;
  notableWorks: string[];
  fetchedAt: string;

  sentimentScore: number;
  trendDirection: "up" | "down" | "stable";
  explanation: string;
  dominantEmotion?: string;
  confidence?: number;
  confidenceLabel?: string;
  scoreLow: number | null;
  scoreHigh: number | null;
  sampleSize: number | null;
  methodAgreement: number | null;
  positiveRatio: number | null;
  neutralRatio: number | null;
  negativeRatio: number | null;
  positiveCount: number | null;
  neutralCount: number | null;
  negativeCount: number | null;
  scoreNews: number | null;
  scoreYoutube: number | null;
  scoreInstagram: number | null;
  trend: TrendPoint[];
  evidence: EvidenceFragment[];

  controversies: Controversy[];
  media: MediaLink[];
  attention: Attention | null;
  timeline: TimelineEvent[];
  accounts: ProfileAccount[];
  candidates: { name: string; description?: string; qid?: string }[];
}

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

type Json = Record<string, unknown>;

function obj(v: unknown): Json {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {};
}
function list(v: unknown): Json[] {
  return Array.isArray(v) ? v.map(obj) : [];
}
function strs(v: unknown): string[] {
  return Array.isArray(v)
    ? v.map((x) => String(x).trim()).filter((x) => x.length > 0)
    : [];
}
function str(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.length > 0 ? v : fallback;
}
function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function mapAttention(v: unknown): Attention | null {
  const a = obj(v);
  const series = list(a.series)
    .map((p) => ({ date: str(p.date), views: num(p.views) ?? 0 }))
    .filter((p) => p.date);
  if (series.length === 0) return null;
  const s = obj(a.summary);
  const peak = obj(s.peak);
  const latest = obj(s.latest);
  return {
    source: str(a.source, "Wikipedia pageviews"),
    series,
    summary:
      num(s.days) != null
        ? {
            days: num(s.days) ?? 0,
            total: num(s.total) ?? 0,
            mean: num(s.mean) ?? 0,
            median: num(s.median) ?? 0,
            peak: { date: str(peak.date), views: num(peak.views) ?? 0 },
            latest: { date: str(latest.date), views: num(latest.views) ?? 0 },
            changePct: num(s.changePct) ?? 0,
          }
        : null,
  };
}

function mapProfile(j: Json): RealProfile {
  const bio = obj(j.biography);
  const s = obj(j.sentiment);
  const entity = obj(j.entity);
  const image = obj(j.image);

  const controversies = corroborated(
    list(bio.controversies).map((c) => parseControversy(c)),
  );

  const dir = s.trendDirection;
  const trendDirection =
    dir === "up" || dir === "down" || dir === "stable" ? dir : "stable";

  const trend: TrendPoint[] = list(s.trendData)
    .map((d) => ({
      date: str(d.date) || str(d.day),
      score: num(d.score) ?? 50,
      mentions:
        num(d.totalMentions) ??
        (num(d.positiveCount) ?? 0) +
          (num(d.neutralCount) ?? 0) +
          (num(d.negativeCount) ?? 0),
    }))
    .filter((d) => d.date);

  return {
    slug: str(j.slug),
    name: str(j.name) || str(j.query),
    verified: Boolean(j.verified),
    wikidataId: str(entity.qid) || undefined,
    imageUrl: str(image.url) || undefined,
    imageSource: str(image.source) || undefined,

    profession: str(bio.profession),
    summary: str(bio.summary),
    background: str(bio.background),
    notableWorks: strs(bio.notableWorks),
    fetchedAt: str(j.fetchedAt, new Date().toISOString()),

    sentimentScore: num(s.overallScore) ?? 50,
    trendDirection,
    explanation: str(s.explanation),
    dominantEmotion: str(s.dominantEmotion) || undefined,
    confidence: num(s.confidence) ?? undefined,
    confidenceLabel: str(s.confidenceLabel) || undefined,
    scoreLow: num(s.scoreLow),
    scoreHigh: num(s.scoreHigh),
    sampleSize: num(s.sampleSize),
    methodAgreement: num(s.methodAgreement),
    positiveRatio: num(s.positiveRatio),
    neutralRatio: num(s.neutralRatio),
    negativeRatio: num(s.negativeRatio),
    positiveCount: num(s.positiveCount),
    neutralCount: num(s.neutralCount),
    negativeCount: num(s.negativeCount),
    scoreNews: num(s.scoreNews),
    scoreYoutube: num(s.scoreYoutube),
    scoreInstagram: num(s.scoreInstagram),
    trend,
    evidence: list(s.evidence)
      .map((e) => ({
        fragment: str(e.fragment),
        source: str(e.source, "news"),
      }))
      .filter((e) => e.fragment),

    controversies,
    media: list(j.media)
      .map((m, i) => ({
        id: str(m.id, String(i)),
        title: str(m.title),
        url: str(m.url),
        source: str(m.source),
        type: str(m.type, "news"),
        channel: str(m.channel) || undefined,
        publishedAt: str(m.publishedAt) || undefined,
        description: str(m.description) || undefined,
        thumbnailUrl: str(m.thumbnailUrl) || undefined,
        sentimentScore: num(m.sentimentScore),
        sentimentTag: str(m.sentimentTag) || undefined,
        topic: topic(m.topic),
        archiveUrl: str(m.archiveUrl) || undefined,
      }))
      .filter((m) => m.title && m.url),
    attention: mapAttention(j.attention),
    timeline: buildTimeline(j.timeline, trend),
    accounts: mapAccounts(obj(entity.facts).links),
    candidates: list(entity.candidates).map((c) => ({
      name: str(c.name) || str(c.label),
      description: str(c.description) || undefined,
      qid: str(c.qid) || undefined,
    })),
  };
}

/**
 * Fetches one real profile. `signal` lets a stale request be aborted
 * when the user searches again.
 */
export async function fetchProfile(
  name: string,
  opts: { qid?: string; signal?: AbortSignal } = {},
): Promise<RealProfile> {
  const headers = await getAuthedHeaders();
  const url = new URL(`${API_BASE}/getCelebrity`);
  url.searchParams.set("name", name);
  if (opts.qid) url.searchParams.set("qid", opts.qid);

  let res: Response;
  try {
    res = await fetch(url, { headers, signal: opts.signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError(
      "unreachable",
      "Could not reach the CritiTrack backend. It may be waking up — try again in a few seconds.",
      0,
    );
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    throw new ApiError(
      body.error ?? "error",
      body.message ?? `Request failed (HTTP ${res.status}).`,
      res.status,
    );
  }

  return mapProfile(obj(await res.json()));
}

/**
 * Fetches the trending rail. Public endpoint — no Firebase token, no App
 * Check — so it can be called before the anonymous session is ready and
 * fails soft: a slow or sleeping backend yields an empty list, and the
 * caller simply renders no rail.
 */
export async function fetchTrending(
  opts: { limit?: number; signal?: AbortSignal } = {},
): Promise<import("./trending").TrendingFigure[]> {
  const url = new URL(`${API_BASE}/trending`);
  if (opts.limit) url.searchParams.set("limit", String(opts.limit));
  try {
    const res = await fetch(url, { signal: opts.signal });
    if (!res.ok) return [];
    const { parseTrending } = await import("./trending");
    return parseTrending(await res.json(), opts.limit ?? 12);
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    return [];
  }
}

export function figureSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
