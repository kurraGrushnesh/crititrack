"use client";


import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

/**
 * Variant B: one soft rounded shape in brand orange, floating and
 * rotating slowly, nudged a little by the pointer. r3f + drei.
 *
 * Lightweight guards: dynamic import (ssr:false, idle-mounted), the
 * frame loop stops when the tab is hidden or reduced-motion is set, and
 * the object is the only thing in the scene.
 */

const Scene = dynamic(() => import("./HeroObjectScene"), {
  ssr: false,
  loading: () => null,
});

export default function HeroObject() {
  const [ready, setReady] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

    useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 500);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="hero-gradient" aria-hidden="true" ref={wrap}>
      {ready && <Scene />}
      <div className="hero-gradient-scrim" />
    </div>
  );
}
