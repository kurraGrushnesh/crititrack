import type { ReactNode } from "react";

/**
 * The one stat tile for the whole product: a value, a label, and any of
 * a few optional extras (a secondary line, a value colour, a thin
 * meter). Every KPI-style number on a profile — the header stats, the
 * sentiment cards, the per-source scores — is this component, so they
 * share one size, one radius, one rhythm.
 *
 * Not for gauges or charts: the Controversy Index ring is its own form.
 */

export interface StatProps {
  label: ReactNode;
  value: ReactNode;
  /** A second, smaller line under the value. */
  sub?: ReactNode;
  /** CSS colour for the value (e.g. a sentiment band token). */
  tone?: string;
  /** 0–100. Draws a thin meter across the bottom of the tile. */
  meter?: number;
  /** CSS colour for the meter fill; defaults to `tone` or the brand. */
  meterColor?: string;
  /** Smaller value type, for words rather than numbers. */
  compact?: boolean;
}

export function Stat({
  label,
  value,
  sub,
  tone,
  meter,
  meterColor,
  compact,
}: StatProps) {
  return (
    <div className="stat">
      <span
        className={`stat-value${compact ? " stat-value-compact" : ""}`}
        style={tone ? { color: tone } : undefined}
      >
        {value}
      </span>
      <span className="stat-label">{label}</span>
      {sub != null && <span className="stat-sub">{sub}</span>}
      {meter != null && (
        <span className="stat-meter" aria-hidden="true">
          <span
            className="stat-meter-fill"
            style={{
              width: `${Math.max(0, Math.min(100, meter))}%`,
              background: meterColor ?? tone ?? "var(--brand-strong)",
            }}
          />
        </span>
      )}
    </div>
  );
}

/** A responsive row of {@link Stat} tiles. */
export function StatRow({ children }: { children: ReactNode }) {
  return <div className="stat-row">{children}</div>;
}
