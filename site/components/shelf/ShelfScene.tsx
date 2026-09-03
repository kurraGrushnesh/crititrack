"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three-stdlib";
import { SHELF_FIGURES, spineColor } from "./shelf-data";

/**
 * CritiTrack's own 3D shelf. Every tracked figure is a volume; the spine
 * carries the name, its colour keyed to the category. Original geometry,
 * materials and content — bevelled boxes, a procedural cloth texture, a
 * warm key light with a real contact shadow, a drag-to-pan shelf and a
 * pull-out on select.
 *
 * Only mounts on a wide viewport with motion allowed (see Shelf.tsx);
 * everything else gets the CSS fallback.
 */

const BOOK_W = 0.4;
const BOOK_H = 2.05;
const BOOK_D = 1.5;
const GAP = 0.06;

const bookGeometry = new RoundedBoxGeometry(BOOK_W, BOOK_H, BOOK_D, 3, 0.02);

/** A linen-ish cloth fill: base colour, a faint weave, a foil hairline,
 * and — when `label` is given — the vertical spine text. */
function makeClothTexture(
  hex: string,
  opts: { label?: string } = {},
): THREE.CanvasTexture {
  const w = 320;
  const h = opts.label ? 1160 : 480;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;

  const base = new THREE.Color(hex);
  ctx.fillStyle = `#${base.getHexString()}`;
  ctx.fillRect(0, 0, w, h);

  // weave — short jittered strokes, alternating slightly lighter/darker
  const light = base.clone().offsetHSL(0, 0, 0.05).getHexString();
  const dark = base.clone().offsetHSL(0, 0, -0.05).getHexString();
  ctx.lineWidth = 1;
  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    ctx.strokeStyle = `#${Math.random() > 0.5 ? light : dark}`;
    ctx.globalAlpha = 0.14;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() > 0.5 ? 3 : 0), y + (Math.random() > 0.5 ? 3 : 0));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  if (opts.label) {
    // foil rules
    ctx.strokeStyle = "rgba(244,244,242,0.4)";
    ctx.lineWidth = 3;
    for (const yy of [190, h - 190]) {
      ctx.beginPath();
      ctx.moveTo(38, yy);
      ctx.lineTo(w - 38, yy);
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillStyle = "#f4f4f2";
    const size = opts.label.length > 17 ? 62 : 82;
    ctx.font = `600 ${size}px Georgia, "Times New Roman", serif`;
    ctx.fillText(opts.label, 0, -16);

    ctx.fillStyle = "rgba(244,244,242,0.55)";
    ctx.font = `500 28px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText("C R I T I T R A C K", 0, 60);
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
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
  const [pulled, setPulled] = useState(false);

  const bg = spineColor(category);

  const materials = useMemo(() => {
    const spineTex = makeClothTexture(bg, { label: name });
    const bodyTex = makeClothTexture(bg);
    const spine = new THREE.MeshStandardMaterial({
      map: spineTex,
      roughness: 0.82,
      metalness: 0.02,
    });
    const body = new THREE.MeshStandardMaterial({
      map: bodyTex,
      roughness: 0.85,
      metalness: 0.02,
    });
    const pages = new THREE.MeshStandardMaterial({
      color: "#e7e0cf",
      roughness: 0.95,
    });
    // [ +X (page edge), -X (binding), +Y, -Y, +Z (spine → camera), -Z ]
    return [pages, body, body, body, spine, body];
  }, [bg, name]);

  const lean = useMemo(() => {
    const s = Math.sin(index * 12.9898) * 43758.5453;
    return (s - Math.floor(s) - 0.5) * 0.055;
  }, [index]);

  const x = (index - (count - 1) / 2) * (BOOK_W + GAP);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const k = 1 - Math.pow(0.0016, Math.min(dt, 0.05));
    const active = hovered || pulled;
    const targetZ = pulled ? 1.1 : hovered ? 0.4 : 0;
    const targetLift = active ? 0.05 : 0;
    const targetTilt = pulled ? -0.02 : hovered ? -0.11 : lean;
    g.position.z += (targetZ - g.position.z) * k;
    g.position.y += (BOOK_H / 2 + targetLift - g.position.y) * k;
    g.rotation.x += (targetTilt - g.rotation.x) * k;
  });

  return (
    <group ref={group} position={[x, BOOK_H / 2, 0]}>
      <mesh
        geometry={bookGeometry}
        material={materials}
        castShadow
        receiveShadow
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
          if (pulled) return;
          setPulled(true);
          document.body.style.cursor = "";
          window.setTimeout(() => onSelect(name), 260);
        }}
      />
    </group>
  );
}

function ShelfBody({ onSelect }: { onSelect: (name: string) => void }) {
  const figures = SHELF_FIGURES;
  const span = figures.length * (BOOK_W + GAP);
  const groupRef = useRef<THREE.Group>(null);

  // drag-to-pan state
  const drag = useRef({ active: false, startX: 0, base: 0, x: 0, vx: 0 });
  const idle = useRef(0);
  const { gl } = useThree();

  useEffect(() => {
    const el = gl.domElement;
    const limit = Math.max(0, span / 2 - 1.2);

    const down = (e: PointerEvent) => {
      drag.current.active = true;
      drag.current.startX = e.clientX;
      drag.current.base = drag.current.x;
      idle.current = 0;
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!drag.current.active) return;
      const dx = ((e.clientX - drag.current.startX) / el.clientWidth) * span;
      const next = THREE.MathUtils.clamp(
        drag.current.base + dx,
        -limit,
        limit,
      );
      drag.current.vx = next - drag.current.x;
      drag.current.x = next;
    };
    const up = (e: PointerEvent) => {
      drag.current.active = false;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* pointer already released */
      }
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointerleave", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointerleave", up);
    };
  }, [gl, span]);

  useFrame((_, dt) => {
    const g = groupRef.current;
    if (!g) return;
    const d = drag.current;
    if (!d.active) {
      idle.current += dt;
      // gentle inertia, then a slow auto-drift once the shelf has been
      // left alone for a moment
      d.vx *= 0.9;
      d.x = THREE.MathUtils.clamp(d.x + d.vx, -100, 100);
      if (idle.current > 2.2) {
        const limit = Math.max(0, span / 2 - 1.2);
        d.x += Math.sin(idle.current * 0.25) * 0.004 * limit;
      }
    }
    g.position.x += (-d.x - g.position.x) * (1 - Math.pow(0.002, dt));
  });

  return (
    <>
      <group ref={groupRef}>
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

      {/* plank */}
      <mesh position={[0, -0.07, 0]} receiveShadow>
        <boxGeometry args={[span + 1.4, 0.14, BOOK_D + 0.55]} />
        <meshStandardMaterial color="#2a2420" roughness={0.8} />
      </mesh>
      {/* front lip */}
      <mesh position={[0, 0.06, (BOOK_D + 0.55) / 2 - 0.03]} receiveShadow>
        <boxGeometry args={[span + 1.4, 0.16, 0.06]} />
        <meshStandardMaterial color="#221d19" roughness={0.85} />
      </mesh>
      {/* back board */}
      <mesh position={[0, BOOK_H / 2, -(BOOK_D / 2) - 0.2]} receiveShadow>
        <boxGeometry args={[span + 1.4, BOOK_H + 1.6, 0.12]} />
        <meshStandardMaterial color="#171310" roughness={0.96} />
      </mesh>
    </>
  );
}

function Rig() {
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const cam = state.camera;
    cam.position.set(0, 1.2 + Math.sin(t * 0.18) * 0.06, 5.9);
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
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [0, 1.2, 5.9], fov: 42 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      style={{ position: "absolute", inset: 0 }}
    >
      <color attach="background" args={["#0f100e"]} />
      <fog attach="fog" args={["#0f100e", 7.5, 14]} />

      <ambientLight intensity={0.42} />
      <directionalLight
        position={[3.5, 7, 5]}
        intensity={2}
        color="#fff2e0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={6}
        shadow-camera-bottom={-4}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-5, 2, 4]} intensity={0.55} color="#86d1ab" />
      <directionalLight position={[0, 3, -6]} intensity={0.4} color="#c87046" />

      <Rig />
      <ShelfBody onSelect={onSelect} />
    </Canvas>
  );
}
