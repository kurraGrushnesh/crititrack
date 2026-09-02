"use client";

import { useRef } from "react";
import { animate } from "animejs";

/**
 * The hero h1 lifts a few pixels on hover, then eases back on
 * mouse-leave. Transform only — no `letter-spacing` tween — so it never
 * reflows the headline or the text below it. Skipped in both directions
 * under `prefers-reduced-motion`.
 */
export default function HeroHeadline({
  children,
}: {
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLHeadingElement>(null);

  function lift(y: number, entering: boolean) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!ref.current) return;
    animate(ref.current, {
      translateY: y,
      duration: entering ? 260 : 200,
      ease: entering ? "outExpo" : "outQuad",
    });
  }

  return (
    <h1
      ref={ref}
      onMouseEnter={() => lift(-4, true)}
      onMouseLeave={() => lift(0, false)}
    >
      {children}
    </h1>
  );
}
