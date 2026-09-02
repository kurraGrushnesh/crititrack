"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Load-in for the hero: the eyebrow, headline and sub-line fade and rise
 * into place, staggered, once on mount. It draws the eye down the hero in
 * reading order and signals the page has settled.
 *
 * Safety:
 *   - `prefers-reduced-motion` → the effect returns and the CSS rule that
 *     hides the children (scoped to `no-preference`) never applies, so
 *     they are simply visible.
 *   - No JS → a `<noscript>` style un-hides them.
 *   - anime.js is imported dynamically, so it stays out of the initial
 *     bundle; the children are hidden by CSS until it resolves, so there
 *     is no flash-then-animate.
 */
export default function HeroReveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const items = Array.from(el.children).filter(
      (c): c is HTMLElement =>
        c instanceof HTMLElement && c.tagName !== "NOSCRIPT",
    );
    if (items.length === 0) return;

    let cancelled = false;
    void import("animejs").then(({ animate, stagger }) => {
      if (cancelled) return;
      animate(items, {
        opacity: [0, 1],
        translateY: [14, 0],
        delay: stagger(70),
        duration: 560,
        ease: "outExpo",
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div ref={ref} className="hero-reveal">
      <noscript>
        <style>{`.hero-reveal > :not(noscript){opacity:1 !important}`}</style>
      </noscript>
      {children}
    </div>
  );
}
