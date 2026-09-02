"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Fades its contents up as they scroll into view. Progressive
 * enhancement: fully visible with no JS and under
 * `prefers-reduced-motion` (the CSS in app.css only hides it while
 * `data-reveal="pending"`, which this sets only when motion is allowed).
 *
 * Renders a plain <div>; wrap it in a landmark element where one is
 * wanted.
 */
export default function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    el.dataset.reveal = "pending";
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const t = e.target as HTMLElement;
            t.style.transitionDelay = `${delay}ms`;
            t.dataset.reveal = "shown";
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);

  return (
    <div ref={ref} className={`reveal ${className}`.trim()}>
      {children}
    </div>
  );
}
