"use client";

import { useRef } from "react";
import { animate } from "animejs";

/**
 * The hero h1, with a small anime.js hover flourish: the headline lifts
 * and its letter-spacing opens slightly, then eases back on mouse-leave.
 * Skipped under `prefers-reduced-motion`.
 */
export default function HeroHeadline({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);

  function hoverIn() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!ref.current) return;
    animate(ref.current, {
      translateY: -6,
      letterSpacing: "0.01em",
      duration: 420,
      ease: "outElastic(1, .6)",
    });
  }

  function hoverOut() {
    if (!ref.current) return;
    animate(ref.current, {
      translateY: 0,
      letterSpacing: "0em",
      duration: 350,
      ease: "outQuad",
    });
  }

  return (
    <h1 ref={ref} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
      {children}
    </h1>
  );
}
