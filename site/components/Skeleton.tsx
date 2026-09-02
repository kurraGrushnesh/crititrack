import type { CSSProperties } from "react";

/**
 * Loading placeholders. One shimmer treatment (`.skeleton`, defined in
 * app.css, reduced-motion aware) so every loading surface looks the
 * same. Shape a skeleton like the real content it stands in for — same
 * heights, same rhythm — so nothing jumps when the data lands.
 */

export function Skeleton({
  h,
  w = "100%",
  radius = 8,
  style,
}: {
  h: number | string;
  w?: number | string;
  radius?: number;
  style?: CSSProperties;
}) {
  return (
    <span
      className="skeleton"
      aria-hidden="true"
      style={{
        display: "block",
        height: h,
        width: w,
        borderRadius: radius,
        ...style,
      }}
    />
  );
}

export function SkeletonText({
  lines = 3,
  lastWidth = "58%",
}: {
  lines?: number;
  lastWidth?: string;
}) {
  return (
    <span aria-hidden="true" style={{ display: "block" }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          h={12}
          radius={4}
          w={i === lines - 1 ? lastWidth : "100%"}
          style={{ marginBottom: i === lines - 1 ? 0 : 10 }}
        />
      ))}
    </span>
  );
}
