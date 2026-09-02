"use client";

/* eslint-disable react-hooks/set-state-in-effect -- comparison scaffolding, deleted once a hero variant is chosen */

import { useEffect, useState } from "react";
import HeroGradient from "@/components/HeroGradient";
import HeroObject from "./HeroObject";
import HeroLiquidLogo from "./HeroLiquidLogo";

/**
 * Compares the hero-background options. Add `?hero=b` (or c, d) to the
 * URL to switch; `a` (ShaderGradient) is the default.
 *
 *   a  ShaderGradient wash          (default, live)
 *   b  r3f floating orange shape
 *   c  LiquidMetal chrome logo
 *   d  no canvas — liquid-glass nav + a flat warm CSS wash
 *
 * Once one is picked, this component and the losers are deleted and the
 * winner is rendered directly in page.tsx.
 */
export default function HeroSwitch() {
  const [variant, setVariant] = useState<"a" | "b" | "c" | "d">("a");

    useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("hero");
    if (v === "b" || v === "c" || v === "d") setVariant(v);
    document.documentElement.dataset.hero = v ?? "a";
  }, []);

  if (variant === "b") return <HeroObject />;
  if (variant === "c") return <HeroLiquidLogo />;
  if (variant === "d") return <div className="hero-gradient hero-flatwash" aria-hidden="true" />;
  return <HeroGradient speed={0.35} />;
}
