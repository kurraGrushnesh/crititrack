"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * A lightweight page transition: the content is re-keyed on the pathname,
 * so React remounts it and the CSS `page-fade` animation replays on every
 * route change. No transition library, no layout shift, and it collapses
 * to nothing under `prefers-reduced-motion` (the keyframe is guarded in
 * minimal.css).
 */
export default function PageFade({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="page-fade">
      {children}
    </div>
  );
}
