"use client";

/* eslint-disable react-hooks/set-state-in-effect -- comparison scaffolding, deleted once a hero variant is chosen */

import { Canvas, useFrame } from "@react-three/fiber";
import { Float, RoundedBox, Environment } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import type { Mesh } from "three";

/**
 * Variant B scene: a single rounded cube in brand orange, floating and
 * turning slowly, with a slight pointer parallax. The frame loop is
 * paused when the tab is hidden.
 */

function Shape({ paused }: { paused: boolean }) {
  const ref = useRef<Mesh>(null);
  const target = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      target.current = {
        x: (e.clientX / window.innerWidth - 0.5) * 0.5,
        y: (e.clientY / window.innerHeight - 0.5) * 0.5,
      };
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useFrame((_, delta) => {
    if (paused || !ref.current) return;
    ref.current.rotation.y += delta * 0.15;
    ref.current.rotation.x += delta * 0.06;
    ref.current.position.x += (target.current.x - ref.current.position.x) * 0.04;
    ref.current.position.y +=
      (-target.current.y - ref.current.position.y) * 0.04;
  });

  return (
    <Float speed={1.1} rotationIntensity={0.3} floatIntensity={0.6}>
      <RoundedBox ref={ref} args={[1.6, 1.6, 1.6]} radius={0.35} smoothness={8}>
        <meshStandardMaterial
          color="#D97757"
          roughness={0.35}
          metalness={0.15}
        />
      </RoundedBox>
    </Float>
  );
}

export default function HeroObjectScene() {
  const [paused, setPaused] = useState(
    typeof document !== "undefined" ? document.hidden : false,
  );

  useEffect(() => {
    const onVis = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) setPaused(true);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return (
    <Canvas
      style={{ position: "absolute", inset: 0 }}
      camera={{ position: [0, 0, 5], fov: 40 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true }}
      frameloop={paused ? "never" : "always"}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 4, 5]} intensity={1.1} />
      <directionalLight position={[-4, -2, -3]} intensity={0.3} color="#FAF7F2" />
      <Environment preset="apartment" />
      <Shape paused={paused} />
    </Canvas>
  );
}
