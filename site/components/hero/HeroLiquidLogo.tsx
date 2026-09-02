"use client";

/* eslint-disable react-hooks/set-state-in-effect -- comparison scaffolding, deleted once a hero variant is chosen */

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

/**
 * Variant C: the CritiTrack mark rendered as slow warm chrome with the
 * LiquidMetal shader from @paper-design/shaders-react. Tuned toward a
 * cream-and-orange brand: warm tint, gentle refraction, low speed.
 *
 * Dynamic + idle-mounted so the shader bundle stays out of the critical
 * path; sits centred in the hero band rather than full-bleed.
 */

const LiquidMetal = dynamic(
  () => import("@paper-design/shaders-react").then((m) => m.LiquidMetal),
  { ssr: false, loading: () => null },
);

export default function HeroLiquidLogo() {
  const [ready, setReady] = useState(false);
  const [reduced, setReduced] = useState(false);

    useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const t = window.setTimeout(() => setReady(true), 500);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="hero-liquid" aria-hidden="true">
      {ready && (
        <LiquidMetal
          style={{ width: "100%", height: "100%" }}
          image="/icon.svg"
          colorBack="#00000000"
          colorTint="#D97757"
          repetition={3.5}
          softness={0.5}
          shiftRed={0.25}
          shiftBlue={-0.15}
          distortion={0.12}
          contour={0.5}
          speed={reduced ? 0 : 0.5}
          scale={0.85}
        />
      )}
    </div>
  );
}
