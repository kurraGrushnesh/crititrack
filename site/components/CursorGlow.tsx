"use client";

import { useEffect, useRef } from "react";

/**
 * A soft glow that eases toward the cursor while it is over the hero —
 * the one bit of pointer-reactive motion on the site, sitting behind the
 * headline near the search.
 *
 * Cost control:
 *   - `prefers-reduced-motion` → nothing mounts.
 *   - The rAF loop only runs while the pointer is inside the band and
 *     the tab is visible; it stops itself once the glow has caught up.
 *   - Movement is `translate3d` on a `pointer-events: none` layer, so it
 *     never hits layout and never intercepts a click.
 *   - Coarse pointers (touch) never start it.
 */
export default function CursorGlow() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const dot = dotRef.current;
    if (!wrap || !dot) return;

    const host = wrap.parentElement;
    if (!host) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const target = { x: 0, y: 0 };
    const cur = { x: 0, y: 0 };
    let raf = 0;
    let inside = false;
    let primed = false;

    const tick = () => {
      cur.x += (target.x - cur.x) * 0.12;
      cur.y += (target.y - cur.y) * 0.12;
      dot.style.transform = `translate3d(${cur.x.toFixed(1)}px, ${cur.y.toFixed(
        1,
      )}px, 0)`;

      const settled =
        Math.abs(target.x - cur.x) < 0.3 && Math.abs(target.y - cur.y) < 0.3;
      if (inside || !settled) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = 0;
      }
    };

    const start = () => {
      if (!raf && !document.hidden) raf = requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      target.x = e.clientX - r.left;
      target.y = e.clientY - r.top;
      if (!primed) {
        primed = true;
        cur.x = target.x;
        cur.y = target.y;
      }
      inside = true;
      dot.style.opacity = "1";
      start();
    };

    const onLeave = () => {
      inside = false;
      dot.style.opacity = "0";
    };

    const onVisibility = () => {
      if (document.hidden) {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      } else if (inside) {
        start();
      }
    };

    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={wrapRef} className="cursor-glow" aria-hidden="true">
      <span ref={dotRef} className="cursor-glow-dot" />
    </div>
  );
}
