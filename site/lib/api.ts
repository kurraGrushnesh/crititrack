"use client";

/**
 * The real backend, called from the web the same way the app calls it:
 * `GET /getCelebrity?name=` with a Firebase ID token and an App Check
 * token. Returns a shape the profile components already render.
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
}

export interface RealProfile {
  slug: string;
  name: string;
  verified: boolean;
  wikidataId?: string;
  imageUrl?: string;
  profession: string;
  summary: string;
  background: string;
  notableWorks: string[];
  fetchedAt: string;
  sentimentScore: number;
  trendDirection: "up" | "down" | "stable";
  explanation: string;
  confidence?: number;
  confidenceLabel?: string;
  scoreNews: number | null;
  scoreYoutube: number | null;
  scoreInstagram: number | null;
  trend: TrendPoint[];
  evidence: EvidenceFragment[];
  controversies: Controversy[];
  media: MediaLink[];
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
function str(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.length > 0 ? v : fallback;
}
function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
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
    name: str(j.name),
    verified: Boolean(j.verified),
    wikidataId: str(entity.qid) || undefined,
    imageUrl: str(image.url) || undefined,
    profession: str(bio.profession),
    summary: str(bio.summary),
    background: str(bio.background),
    notableWorks: Array.isArray(bio.notableWorks)
      ? bio.notableWorks.map((w) => String(w))
      : [],
    fetchedAt: str(j.fetchedAt, new Date().toISOString()),
    sentimentScore: num(s.overallScore) ?? 50,
    trendDirection,
    explanation: str(s.explanation),
    confidence: num(s.confidence) ?? undefined,
    confidenceLabel: str(s.confidenceLabel) || undefined,
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
      }))
      .filter((m) => m.title && m.url),
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
