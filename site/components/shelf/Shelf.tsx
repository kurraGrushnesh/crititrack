"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SHELF_FIGURES, spineColor } from "./shelf-data";

const ShelfScene = dynamic(() => import("./ShelfScene"), {
  ssr: false,
  loading: () => null,
});

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

/** Book spines as a plain scrolling row — the graceful version for
 * phones, no-JS, and reduced-motion. Same links as the scene. */
function ShelfFallback() {
  return (
    <ul className="shelf-fallback" aria-label="Tracked figures">
      {SHELF_FIGURES.map((f) => (
        <li key={f.name}>
          <Link
            href={`/figure/?q=${encodeURIComponent(f.name)}`}
            className="shelf-spine"
            style={{ background: spineColor(f.category) }}
          >
            <span>{f.name}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function Shelf() {
  const router = useRouter();
  const wide = useMediaQuery("(min-width: 900px)", false);
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)", false);
  const eligible = wide && !reduced;

  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!eligible) return;
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    let timer = 0;
    let idle = 0;
    if (w.requestIdleCallback) {
      idle = w.requestIdleCallback(() => setReady(true), { timeout: 1200 });
    } else {
      timer = window.setTimeout(() => setReady(true), 500);
    }
    return () => {
      if (timer) clearTimeout(timer);
      if (idle && w.cancelIdleCallback) w.cancelIdleCallback(idle);
    };
  }, [eligible]);

  const select = useCallback(
    (name: string) => {
      router.push(`/figure/?q=${encodeURIComponent(name)}`);
    },
    [router],
  );

  if (!eligible) {
    return (
      <div className="shelf-stage" data-mode="flat">
        <ShelfFallback />
      </div>
    );
  }

  return (
    <div className="shelf-stage" data-mode="scene">
      {ready ? <ShelfScene onSelect={select} /> : <ShelfFallback />}
    </div>
  );
}
