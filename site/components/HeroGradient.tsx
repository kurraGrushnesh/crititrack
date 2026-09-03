"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

/**
 * A slow, soft moving gradient behind the home hero only.
 *
 * ShaderGradient is a WebGL canvas (three.js + r3f), so it is:
 *   - dynamically imported with `ssr: false` — nothing renders on the
 *     server, and the ~500 KB of three.js is never in the critical path;
 *   - mounted only after first paint, on an idle callback, so it does not
 *     compete with the hero text and the fonts;
 *   - frozen (`animate="off"`) under `prefers-reduced-motion`;
 *   - purely decorative — `pointer-events: none`, `aria-hidden`, and the
 *     hero reads fine with it turned off entirely.
 *
 * Tune `speed` (maps to ShaderGradient's `uSpeed`) to taste.
 */

const ShaderGradientCanvas = dynamic(
  () => import("@shadergradient/react").then((m) => m.ShaderGradientCanvas),
  { ssr: false, loading: () => null },
);
const ShaderGradient = dynamic(
  () => import("@shadergradient/react").then((m) => m.ShaderGradient),
  { ssr: false, loading: () => null },
);

function useMediaQuery(query: string, serverValue: boolean): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

export default function HeroGradient({ speed = 0.35 }: { speed?: number }) {
  const [ready, setReady] = useState(false);
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)", false);
  // The WebGL canvas (three.js + r3f) is the most expensive thing on the
  // page. On a phone it is not worth the frame budget — a static CSS
  // wash carries the same cream -> orange look. `serverValue: false`
  // matches what a fresh mobile visitor gets before hydration, so the
  // static fill shows first and the canvas never mounts there.
  const wide = useMediaQuery("(min-width: 768px)", false);
  const showCanvas = wide && !reduced;

  useEffect(() => {
    // Wait until the browser is idle so the hero text and fonts land
    // first, then mount the canvas.
    const ric = (
      window as unknown as {
        requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
        cancelIdleCallback?: (id: number) => void;
      }
    ).requestIdleCallback;
    const cic = (
      window as unknown as { cancelIdleCallback?: (id: number) => void }
    ).cancelIdleCallback;

    let timer = 0;
    let idleId = 0;
    if (ric) idleId = ric(() => setReady(true), { timeout: 1500 });
    else timer = window.setTimeout(() => setReady(true), 600);

    return () => {
      if (idleId && cic) cic(idleId);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  return (
    <div className="hero-gradient" aria-hidden="true" data-static={!showCanvas}>
      {ready && showCanvas && (
        <ShaderGradientCanvas
          style={{ position: "absolute", inset: 0 }}
          pixelDensity={1}
          fov={40}
          pointerEvents="none"
        >
          <ShaderGradient
            // `plane` keeps the hue clean cream -> orange. `waterPlane`
            // drifts green at this low brightness.
            type="plane"
            // Cream leads, so the headline (left/centre) always sits on
            // the pale end; the warm orange is offset to the right,
            // pooling in the empty space beside the copy.
            color1="#FAF7F2"
            color2="#F0DAC8"
            color3="#D97757"
            animate="on"
            uSpeed={speed}
            uStrength={1}
            uDensity={1}
            uFrequency={2}
            grain="on"
            grainBlending={0.13}
            positionX={0.6}
            positionY={0}
            positionZ={0}
            cAzimuthAngle={190}
            cPolarAngle={115}
            cDistance={4.6}
            brightness={0.95}
            reflection={0.1}
          />
        </ShaderGradientCanvas>
      )}
      <div className="hero-gradient-scrim" />
    </div>
  );
}
