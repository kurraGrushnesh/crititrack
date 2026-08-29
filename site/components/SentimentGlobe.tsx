"use client";

/**
 * The hero object: a slowly rotating globe with a point for each tracked
 * figure, coloured by sentiment.
 *
 * It is the most characteristic thing in this product's world — coverage
 * of people, everywhere, moving — so it opens the page rather than a
 * screenshot would.
 *
 * Three constraints shape the implementation:
 *
 *   1. It must never block first paint. The page is readable and complete
 *      without it; it is loaded lazily and fades in.
 *   2. It must respect `prefers-reduced-motion`. Rotation stops entirely
 *      rather than merely slowing.
 *   3. It must not be the only way to get the information. Every figure
 *      shown here is also listed as text below.
 */

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

export type Figure = {
  name: string;
  /** 0–100 sentiment. */
  score: number;
  /** Degrees. */
  lat: number;
  lon: number;
};

/** Sentiment bands, matching the app's own thresholds. */
function colorFor(score: number): THREE.Color {
  if (score >= 65) return new THREE.Color("#3FD5A0");
  if (score >= 40) return new THREE.Color("#E3BE5C");
  return new THREE.Color("#FF7A66");
}

/** Latitude/longitude to a point on a sphere of radius r. */
function toVector(lat: number, lon: number, r: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

const RADIUS = 2;

function Globe({ figures, reduced }: { figures: Figure[]; reduced: boolean }) {
  const group = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    // Reduced motion stops the rotation outright. A slower spin is still
    // motion, and this is exactly the kind of continuous movement the
    // preference exists to switch off.
    if (reduced || !group.current) return;
    group.current.rotation.y += delta * 0.12;
  });

  // The wireframe reads as a globe without needing a texture, which would
  // be another network request before the hero is complete.
  const wire = useMemo(() => new THREE.IcosahedronGeometry(RADIUS, 3), []);

  const points = useMemo(
    () =>
      figures.map((f) => ({
        ...f,
        position: toVector(f.lat, f.lon, RADIUS * 1.02),
        color: colorFor(f.score),
      })),
    [figures],
  );

  return (
    <group ref={group}>
      <mesh geometry={wire}>
        <meshBasicMaterial
          color="#2A3145"
          wireframe
          transparent
          opacity={0.55}
        />
      </mesh>

      <mesh>
        <sphereGeometry args={[RADIUS * 0.985, 48, 48]} />
        <meshBasicMaterial color="#0E1119" transparent opacity={0.92} />
      </mesh>

      {points.map((p) => (
        <group key={p.name} position={p.position}>
          <mesh>
            <sphereGeometry args={[0.055, 12, 12]} />
            <meshBasicMaterial color={p.color} />
          </mesh>
          {/* A soft halo so a point stays visible against the wireframe. */}
          <mesh>
            <sphereGeometry args={[0.11, 12, 12]} />
            <meshBasicMaterial color={p.color} transparent opacity={0.18} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export default function SentimentGlobe({
  figures,
  reduced,
}: {
  figures: Figure[];
  reduced: boolean;
}) {
  // Force one measurement after mount.
  //
  // react-three-fiber sizes its canvas from the parent via
  // react-use-measure. In this configuration — a `next/dynamic` import
  // with `ssr: false`, so the component mounts after hydration — that
  // initial measurement does not land, and the canvas is left at the
  // browser's default 300x150 inside a parent that is 483x460. Nothing
  // is drawn, and the hero looks empty.
  //
  // It corrects itself the moment anything triggers a resize, which is
  // why it is invisible in development the instant you touch the window
  // and was only caught by loading the deployed page and reading the
  // canvas attributes. Dispatching one resize after paint is blunt, but
  // it is the same event the browser would send and it costs a single
  // frame.
  useEffect(() => {
    const id = requestAnimationFrame(() =>
      window.dispatchEvent(new Event("resize")),
    );
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <Canvas
      camera={{ position: [0, 0, 6], fov: 45 }}
      dpr={[1, 2]}
      // The globe is decorative; the same information is in the list
      // below, so it is hidden from assistive technology rather than
      // announced as an unlabelled canvas.
      aria-hidden="true"
      gl={{ antialias: true, alpha: true }}
      style={{ width: "100%", height: "100%" }}
    >
      <ambientLight intensity={1} />
      <Globe figures={figures} reduced={reduced} />
    </Canvas>
  );
}
