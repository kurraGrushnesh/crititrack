"use client";

/**
 * The hero.
 *
 * The copy and the figure list are complete on their own; the globe is
 * loaded afterwards and fades in. Someone on a slow connection, with
 * JavaScript disabled, or using a screen reader gets the whole message —
 * the 3D is an enhancement, never the carrier.
 */

import dynamic from "next/dynamic";
import { useCallback, useSyncExternalStore } from "react";
import type { Figure } from "./SentimentGlobe";

// Lazy so three.js is never in the critical path. `ssr: false` because
// WebGL has no meaning during a static export.
const SentimentGlobe = dynamic(() => import("./SentimentGlobe"), {
  ssr: false,
  loading: () => null,
});

/**
 * Reads a media query as external state.
 *
 * The obvious version of this sets state from an effect, which costs a
 * second render pass on every mount and is what `useSyncExternalStore`
 * exists to replace: the value is read during render and the subscription
 * is the only thing that lives outside it.
 *
 * `serverValue` is what the statically exported HTML is built with, so it
 * has to be the conservative choice — the markup a phone can use — with
 * the client upgrading it after hydration.
 */
function useMediaQuery(query: string, serverValue: boolean): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [
    query,
  ]);

  const getServerSnapshot = useCallback(() => serverValue, [serverValue]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export default function Hero({ figures }: { figures: Figure[] }) {
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)", false);

  // Phones get the static composition instead: a WebGL canvas is the most
  // expensive thing on the page and the least useful on a small screen,
  // where the points are too small to read anyway. The export assumes
  // narrow, so the cheap markup ships and wide viewports upgrade.
  const narrow = useMediaQuery("(max-width: 720px)", true);
  const showGlobe = !narrow;

  return (
    <header className="hero">
      <div className="hero-inner">
        <div className="hero-copy">
          <p className="eyebrow">Accountability tracking for public figures</p>
          <h1>What has this person actually been criticised for?</h1>
          <p className="lede">
            CritiTrack turns scattered news, video and social coverage into a
            structured, evidence-linked record — what happened, how serious it
            was, and whether sentiment is moving. Every serious claim cites a
            source, and the ones nothing supports are never shown.
          </p>

          <div className="cta-row">
            <a className="btn btn-primary" href="#how">
              How it works
            </a>
            <a className="btn btn-ghost" href="#method">
              Read the method
            </a>
          </div>

          <ul className="figure-list" aria-label="Coverage areas tracked">
            {figures.map((f) => (
              <li key={f.name}>
                <span
                  className="dot"
                  style={{ background: band(f.score) }}
                  aria-hidden="true"
                />
                <span className="figure-name">{f.name}</span>
                <span className="figure-score">{f.score}</span>
              </li>
            ))}
          </ul>
          <p className="figure-note">
            Illustrative figures. Scores are algorithmically assessed from
            public reporting, not verified fact.
          </p>
        </div>

        <div className="hero-visual">
          {showGlobe ? (
            <div className="globe-fade">
              <SentimentGlobe figures={figures} reduced={reduced} />
            </div>
          ) : (
            <div className="globe-static" aria-hidden="true" />
          )}
        </div>
      </div>
    </header>
  );
}

/** Sentiment bands, matching the app's own thresholds. */
function band(score: number): string {
  if (score >= 65) return "#3FD5A0";
  if (score >= 40) return "#E3BE5C";
  return "#FF7A66";
}
