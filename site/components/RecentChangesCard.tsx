import type { ChangeEvent, ChangeSeverity } from "@/lib/changes";

/**
 * The compact "Recent Changes" summary — the top few detected changes
 * since the last time this browser saw the profile, with a link to the
 * full history. Never the dominant profile element: at most 4 rows.
 *
 * Note the honest scope: CritiTrack has no backend snapshot store, so
 * this compares against this device's own local last-seen copy of the
 * profile, not a server-authoritative previous state — it has nothing
 * to show the first time a reader opens a profile on a given device.
 */

const SEVERITY_DOT: Record<ChangeSeverity, string> = {
  MAJOR: "🔴",
  SIGNIFICANT: "🟡",
  MINOR: "🔵",
  INFO: "⚪",
};

export default function RecentChangesCard({ changes }: { changes: ChangeEvent[] }) {
  if (changes.length === 0) return null;
  const top = changes.slice(0, 4);

  return (
    <div className="rc-card">
      <div className="rc-card-title">Recent Changes</div>
      <ul className="rc-card-list">
        {top.map((c) => (
          <li key={c.changeId} className="rc-card-row">
            <span aria-hidden="true">{SEVERITY_DOT[c.severity]}</span>
            <span className="rc-card-text">{c.title}</span>
          </li>
        ))}
      </ul>
      <a href="#change-history" className="rc-card-link">
        View all changes →
      </a>
    </div>
  );
}
