"use client";

import { useEffect, useRef, useState } from "react";
import { fetchProfile, ApiError, type RealProfile } from "./api";

/**
 * One shared client cache for profiles. The site is static, so this is
 * the whole persistence story: a search that was run once this session
 * comes back instantly, and two components asking for the same name make
 * one request between them.
 */
const cache = new Map<string, RealProfile>();
const inflight = new Map<string, Promise<RealProfile>>();

const TTL_MS = 10 * 60 * 1000;
const stamped = new Map<string, number>();

function key(name: string): string {
  return name.trim().toLowerCase();
}

/** Lets the "how it's built" demos and tests prime the cache. */
export function primeProfile(name: string, profile: RealProfile): void {
  cache.set(key(name), profile);
  stamped.set(key(name), Date.now());
}

async function load(name: string, signal: AbortSignal): Promise<RealProfile> {
  const k = key(name);
  const age = Date.now() - (stamped.get(k) ?? 0);
  const hit = cache.get(k);
  if (hit && age < TTL_MS) return hit;

  const existing = inflight.get(k);
  if (existing) return existing;

  const p = fetchProfile(name, { signal })
    .then((profile) => {
      cache.set(k, profile);
      stamped.set(k, Date.now());
      return profile;
    })
    .finally(() => {
      inflight.delete(k);
    });
  inflight.set(k, p);
  return p;
}

export type CelebrityState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; profile: RealProfile }
  | { status: "not-found"; message: string }
  | { status: "error"; message: string; code: string; canRetry: boolean };

type Resolved = { name: string; nonce: number; state: CelebrityState };

/**
 * Resolves one public figure by name against the real backend.
 *
 * Route-driven, so there is no keystroke debounce to do here — the name
 * only changes when the user submits a search or opens a link. What it
 * does handle: a stale request is aborted when `name` changes, the
 * result is cached, and every failure mode lands in a typed state the
 * page can render.
 *
 * `loading` and `idle` are derived during render from whether a resolved
 * result exists for the current name, so the effect only ever calls
 * setState from an async callback — never synchronously in its body.
 */
export function useCelebrity(name: string | null): {
  state: CelebrityState;
  retry: () => void;
} {
  const trimmed = name?.trim() ?? "";
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [nonce, setNonce] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!trimmed) return;

    const ctrl = new AbortController();
    const settle = (state: CelebrityState) => {
      if (ctrl.signal.aborted || !mounted.current) return;
      setResolved({ name: trimmed, nonce, state });
    };

    load(trimmed, ctrl.signal)
      .then((profile) => {
        if (!profile.name) {
          settle({
            status: "not-found",
            message: `Nothing came back for “${trimmed}”. Check the spelling, or try their full name.`,
          });
          return;
        }
        settle({ status: "ready", profile });
      })
      .catch((e: unknown) => {
        if ((e as Error).name === "AbortError") return;
        const err = e as ApiError;
        if (err.status === 404 || err.code === "not_found") {
          settle({
            status: "not-found",
            message: `No public figure named “${trimmed}” was found.`,
          });
          return;
        }
        settle({
          status: "error",
          code: err.code ?? "error",
          message:
            err.message ??
            "Something went wrong reaching the analysis backend.",
          canRetry: err.status === 0 || err.status >= 500 || !err.status,
        });
      });

    return () => ctrl.abort();
  }, [trimmed, nonce]);

  const current =
    resolved && resolved.name === trimmed && resolved.nonce === nonce
      ? resolved.state
      : null;

  const state: CelebrityState = !trimmed
    ? { status: "idle" }
    : (current ?? { status: "loading" });

  return { state, retry: () => setNonce((n) => n + 1) };
}
