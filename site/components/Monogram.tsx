/**
 * An initials avatar. No portrait images: the site's CSP allows only
 * same-origin images, and a broken or slow portrait is worse than a
 * clean monogram. The background tint is derived from the name so a
 * person looks the same everywhere they appear.
 */
export default function Monogram({
  name,
  size = 56,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;

  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        flex: "none",
        fontWeight: 700,
        fontSize: size * 0.36,
        color: "var(--text)",
        background: `linear-gradient(135deg, hsl(${hue} 42% 22%), hsl(${
          (hue + 40) % 360
        } 38% 15%))`,
        border: "1px solid var(--border-strong)",
      }}
    >
      {initials}
    </span>
  );
}
