"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react";

/**
 * Fades its contents up as they scroll into view — once. Progressive
 * enhancement: fully visible with no JS and under
 * `prefers-reduced-motion` (the CSS in app.css only hides it while
 * `data-reveal="pending"`, which this sets only when motion is allowed).
 *
 * The "hide" is written in a layout effect, before the browser paints,
 * so there is no flash of the content at full opacity before it drops
 * out. The transition is `opacity` + `translate3d` (compositor only);
 * `will-change` is cleared once shown so a long page isn't holding
 * dozens of layers.
 *
 * Renders a plain <div>; wrap it in a landmark element where one is
 * wanted.
 */

const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

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

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.dataset.reveal = "pending";
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || el.dataset.reveal !== "pending") return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const t = e.target as HTMLElement;
          if (delay) t.style.transitionDelay = `${delay}ms`;
          t.dataset.reveal = "shown";
          const clear = () => {
            t.style.willChange = "";
            t.style.transitionDelay = "";
            t.removeEventListener("transitionend", clear);
          };
          t.addEventListener("transitionend", clear);
          io.unobserve(e.target);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -48px 0px" },
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
