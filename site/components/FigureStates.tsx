import Link from "next/link";
import Button from "./Button";
import { Skeleton, SkeletonText } from "./Skeleton";

/**
 * The three non-ready states of a profile page: loading, not-found,
 * error. Kept together so they stay visually consistent — same width,
 * same vertical placement, same icon language — and the skeleton is
 * shaped like the real profile so the switch to content is a fill, not
 * a reflow.
 */

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function SectionHeadSkeleton({ w = 180 }: { w?: number }) {
  return <Skeleton h={22} w={w} radius={4} style={{ marginBottom: 24 }} />;
}

export function FigureSkeleton({ name }: { name: string }) {
  return (
    <main id="main" className="figure-main" aria-busy="true">
      <div className="profile-head">
        <div>
          <div className="breadcrumb">
            <Link href="/">Home</Link>
            <span>/</span>
            <span>{name === "…" ? "" : name}</span>
          </div>
          <h1>{name}</h1>
          <p className="subtitle">Building the profile from live coverage…</p>

          <div className="stat-row" style={{ marginTop: 28 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="stat">
                <Skeleton h={26} w="55%" radius={4} />
                <Skeleton h={10} w="40%" radius={3} style={{ marginTop: 8 }} />
              </div>
            ))}
          </div>
        </div>

        <div className="portrait-frame">
          <span className="mono-xl">{name === "…" ? "" : initials(name)}</span>
        </div>
      </div>

      <div className="min-section" style={{ paddingTop: 8 }}>
        <div className="bio">
          <SkeletonText lines={3} />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[64, 48, 80, 56].map((w, i) => (
              <Skeleton key={i} h={24} w={w} radius={999} />
            ))}
          </div>
        </div>
      </div>

      <hr className="divider-rule" />
      <div className="min-section">
        <SectionHeadSkeleton w={150} />
        <Skeleton h={132} radius={12} />
      </div>

      <hr className="divider-rule" />
      <div className="min-section">
        <SectionHeadSkeleton w={200} />
        <div className="stat-row" style={{ marginBottom: 20 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="stat">
              <Skeleton h={26} w="50%" radius={4} />
              <Skeleton h={10} w="45%" radius={3} style={{ marginTop: 8 }} />
            </div>
          ))}
        </div>
        <Skeleton h={168} radius={12} />
      </div>

      <hr className="divider-rule" />
      <div className="min-section">
        <SectionHeadSkeleton w={170} />
        <div style={{ display: "grid", gap: 10 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} h={88} radius={12} />
          ))}
        </div>
      </div>

      <p className="figure-state-note">
        The analysis backend sleeps when idle — the first search after a quiet
        spell can take 20–40 seconds.
      </p>
    </main>
  );
}

function StateIcon({ kind }: { kind: "empty" | "error" }) {
  return (
    <span className={`figure-state-icon figure-state-icon-${kind}`}>
      {kind === "empty" ? (
        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
          <circle
            cx="11"
            cy="11"
            r="7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="m20 20-3.5-3.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
          <path
            d="M12 3 2 20h20L12 3Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M12 9v5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="12" cy="17.5" r="1.2" fill="currentColor" />
        </svg>
      )}
    </span>
  );
}

export function FigureNotFound({
  message,
  onHome,
}: {
  message: string;
  onHome: () => void;
}) {
  return (
    <main id="main" className="figure-state">
      <StateIcon kind="empty" />
      <h1>No match</h1>
      <p>{message}</p>
      <div className="figure-state-actions">
        <Button type="button" onClick={onHome}>
          Back to home
        </Button>
        <Link href="/category/actors" className="figure-state-link">
          Browse by category
        </Link>
      </div>
    </main>
  );
}

export function FigureError({
  message,
  canRetry,
  onRetry,
}: {
  message: string;
  canRetry: boolean;
  onRetry: () => void;
}) {
  return (
    <main id="main" className="figure-state">
      <StateIcon kind="error" />
      <h1>Couldn’t load this profile</h1>
      <p>{message}</p>
      {canRetry && (
        <div className="figure-state-actions">
          <Button type="button" onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
    </main>
  );
}
