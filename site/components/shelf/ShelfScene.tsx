"use client";

import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SHELF_FIGURES, spineColor } from "./shelf-data";

/**
 * CritiTrack's own 3D shelf. Every figure the site tracks is a volume;
 * the spine carries the name, its colour keyed to the category. Built
 * from plain three.js primitives — boxes, standard materials, a
 * canvas-drawn label texture — with a slow camera drift and a
 * lift-on-hover. Original geometry and content; nothing here derives
 * from any third-party scene.
 *
 * Only mounted on a wide viewport with motion allowed (see Shelf.tsx);
 * everything else gets the CSS fallback.
 */

const BOOK_W = 0.36;
const BOOK_H = 2.0;
const BOOK_D = 1.45;
const GAP = 0.05;

function makeSpineTexture(name: string, bg: string): THREE.CanvasTexture {
  const w = 256;
  const h = 1024;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // A hairline rule near the top, editorial-style.
  ctx.strokeStyle = "rgba(244,244,242,0.35)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 150);
  ctx.lineTo(w, 150);
  ctx.stroke();

  ctx.translate(w / 2, h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = "#f4f4f2";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const size = name.length > 16 ? 58 : 74;
  ctx.font = `600 ${size}px Georgia, "Times New Roman", serif`;
  ctx.fillText(name, 0, -14);

  ctx.font = `500 30px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillStyle = "rgba(244,244,242,0.6)";
  ctx.fillText("CRITITRACK", 0, 60);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function Book({
  index,
  count,
  name,
  category,
  onSelect,
}: {
  index: number;
  count: number;
  name: string;
  category: string;
  onSelect: (name: string) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  const bg = spineColor(category);
  const spineTex = useMemo(() => makeSpineTexture(name, bg), [name, bg]);

  // Deterministic small lean per book so the row isn't a perfect grid.
  const lean = useMemo(() => {
    const s = Math.sin(index * 12.9898) * 43758.5453;
    return ((s - Math.floor(s)) - 0.5) * 0.06;
  }, [index]);

  const x = (index - (count - 1) / 2) * (BOOK_W + GAP);

  const materials = useMemo(() => {
    const body = new THREE.MeshStandardMaterial({
      color: new THREE.Color(bg).multiplyScalar(0.82),
      roughness: 0.72,
      metalness: 0.02,
    });
    const spine = new THREE.MeshStandardMaterial({
      map: spineTex,
      roughness: 0.68,
      metalness: 0.02,
    });
    const pages = new THREE.MeshStandardMaterial({
      color: "#e9e4d6",
      roughness: 0.9,
    });
    // [ +X, -X, +Y, -Y, +Z (spine, faces camera), -Z ]
    return [pages, body, body, body, spine, body];
  }, [bg, spineTex]);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const k = 1 - Math.pow(0.0015, dt);
    const targetZ = hovered ? 0.42 : 0;
    const targetLift = hovered ? 0.06 : 0;
    const targetTilt = hovered ? -0.12 : lean;
    g.position.z += (targetZ - g.position.z) * k;
    g.position.y += (BOOK_H / 2 + targetLift - g.position.y) * k;
    g.rotation.x += (targetTilt - g.rotation.x) * k;
  });

  return (
    <group
      ref={group}
      position={[x, BOOK_H / 2, 0]}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "";
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(name);
      }}
    >
      <mesh material={materials}>
        <boxGeometry args={[BOOK_W, BOOK_H, BOOK_D]} />
      </mesh>
    </group>
  );
}

function Shelf({ onSelect }: { onSelect: (name: string) => void }) {
  const figures = SHELF_FIGURES;
  const span = figures.length * (BOOK_W + GAP);

  return (
    <group>
      {/* plank */}
      <mesh position={[0, -0.06, 0]} receiveShadow>
        <boxGeometry args={[span + 0.8, 0.12, BOOK_D + 0.5]} />
        <meshStandardMaterial color="#241f1b" roughness={0.85} />
      </mesh>
      {/* back board */}
      <mesh position={[0, BOOK_H / 2, -(BOOK_D / 2) - 0.18]}>
        <boxGeometry args={[span + 0.8, BOOK_H + 1.4, 0.1]} />
        <meshStandardMaterial color="#1a1613" roughness={0.95} />
      </mesh>
      {figures.map((f, i) => (
        <Book
          key={f.name}
          index={i}
          count={figures.length}
          name={f.name}
          category={f.category}
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}

function Drift() {
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const cam = state.camera;
    cam.position.set(
      Math.sin(t * 0.11) * 1.5,
      1.15 + Math.sin(t * 0.07) * 0.1,
      5.6,
    );
    cam.lookAt(0, 0.95, 0);
  });
  return null;
}

export default function ShelfScene({
  onSelect,
}: {
  onSelect: (name: string) => void;
}) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 1.15, 5.6], fov: 42 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      style={{ position: "absolute", inset: 0 }}
    >
      <color attach="background" args={["#0f100e"]} />
      <fog attach="fog" args={["#0f100e", 7, 13]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 6, 5]} intensity={1.5} color="#fff4e6" />
      <directionalLight position={[-4, 2, 3]} intensity={0.5} color="#86d1ab" />
      <Drift />
      <Shelf onSelect={onSelect} />
    </Canvas>
  );
}
