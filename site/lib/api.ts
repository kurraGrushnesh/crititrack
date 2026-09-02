"use client";

/**
 * The real backend, called from the web the same way the app calls it:
 * `GET /getCelebrity?name=` with a Firebase ID token and an App Check
 * token. Returns the full profile shape the page components render.
 *
 * The mapper is deliberately total: every block the backend sends
 * (`biography`, `sentiment`, `attention`, `media`, `entity.facts`) is
 * captured here, so a new UI section never has to reach past this file
 * to a raw response.
 */

import { getAuthedHeaders } from "./firebase";
import {
  parseControversy,
  corroborated,
  type Controversy,
} from "./controversy";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "https://crititrack-api.onrender.com";

export interface EvidenceFragment {
  fragment: string;
  source: string;
}
export interface TrendPoint {
  date: string;
  score: number;
}
export interface MediaLink {
  id: string;
  title: string;
  url: string;
  source: string;
  type: string;
  publishedAt?: string;
  description?: string;
  thumbnailUrl?: string;
  sentimentScore: number | null;
  sentimentTag?: string;
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

export interface Award {
  label: string;
  year?: number;
}
export interface EntityFacts {
  birthDate?: string;
  deathDate?: string;
  birthPlace?: string;
  citizenship: string[];
  occupations: string[];
  education: string[];
  awards: Award[];
  notableWorks: string[];
  links: Record<string, string>;
}

export interface RealProfile {
  slug: string;
  name: string;
  verified: boolean;
  wikidataId?: string;
  entityLabel?: string;
  entityDescription?: string;
  aliases: string[];
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
  facts: EntityFacts;
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

function mapFacts(v: unknown): EntityFacts {
  const f = obj(v);
  const links: Record<string, string> = {};
  for (const [k, val] of Object.entries(obj(f.links))) {
    if (typeof val === "string" && val.length > 0) links[k] = val;
  }
  return {
    birthDate: str(f.birthDate) || undefined,
    deathDate: str(f.deathDate) || undefined,
    birthPlace: str(f.birthPlace) || undefined,
    citizenship: strs(f.citizenship),
    occupations: strs(f.occupations),
    education: strs(f.education),
    awards: list(f.awards)
      .map((a) => ({ label: str(a.label), year: num(a.year) ?? undefined }))
      .filter((a) => a.label),
    notableWorks: strs(f.notableWorks),
    links,
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

  return {
    slug: str(j.slug),
    name: str(j.name) || str(j.query),
    verified: Boolean(j.verified),
    wikidataId: str(entity.qid) || undefined,
    entityLabel: str(entity.label) || undefined,
    entityDescription: str(entity.description) || undefined,
    aliases: strs(entity.aliases),
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
    trend: list(s.trendData)
      .map((d) => ({
        date: str(d.date) || str(d.day),
        score: num(d.score) ?? 50,
      }))
      .filter((d) => d.date),
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
        publishedAt: str(m.publishedAt) || undefined,
        description: str(m.description) || undefined,
        thumbnailUrl: str(m.thumbnailUrl) || undefined,
        sentimentScore: num(m.sentimentScore),
        sentimentTag: str(m.sentimentTag) || undefined,
      }))
      .filter((m) => m.title && m.url),
    attention: mapAttention(j.attention),
    facts: mapFacts(entity.facts),
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

export function figureSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
