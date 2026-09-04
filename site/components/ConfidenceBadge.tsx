import type { ConfidenceBadge as Badge } from "@/lib/confidence";

/**
 * Renders one {@link Badge} from `lib/confidence` — the shared
 * high/moderate/low vocabulary used for sentiment confidence, Wikidata
 * fact precision and controversy corroboration. The gloss is the
 * `title`, so hovering explains the level.
 */

function Icon({ name }: { name: Badge["icon"] }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (name === "check-double") {
    return (
      <svg {...common}>
        <path d="M2 13l4 4L15 8" />
        <path d="M12 15l1.5 1.5L22 8" />
      </svg>
    );
  }
  if (name === "check") {
    return (
      <svg {...common}>
        <path d="M4 12l5 5L20 6" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M5 12h14" />
    </svg>
  );
}

export default function ConfidenceBadge({
  badge,
  showLabel = true,
}: {
  badge: Badge;
  showLabel?: boolean;
}) {
  return (
    <span className={`confbadge is-${badge.level}`} title={badge.gloss}>
      <Icon name={badge.icon} />
      {showLabel && badge.label}
    </span>
  );
}
