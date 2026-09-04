import type { ReactNode } from "react";

/**
 * Content that is available to assistive technology but not shown.
 *
 * Used to give the inline-SVG charts a real text alternative — the actual
 * dated numbers, as a table — rather than only a one-line `aria-label`
 * that says "sentiment is mixed" and nothing else. Styles are inline so
 * this works with no global CSS.
 *
 * The standard clip technique: taken out of flow, clipped to nothing, but
 * still rendered so a screen reader reaches it.
 */
const STYLE: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
  border: 0,
};

export default function VisuallyHidden({
  children,
  as: Tag = "span",
}: {
  children: ReactNode;
  as?: "span" | "div";
}) {
  return <Tag style={STYLE}>{children}</Tag>;
}
