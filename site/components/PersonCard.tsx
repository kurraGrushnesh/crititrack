import type { RosterEntry } from "@/lib/catalog";
import Monogram from "./Monogram";

const APP = "/app/";

/**
 * A catalogue person. The card carries only public facts — name, field,
 * birth decade. It links into the real app, which is where the sourced,
 * confidence-rated, evidence-linked profile lives; the static site never
 * asserts a score about a real person.
 */
export default function PersonCard({
  entry,
  rank,
}: {
  entry: RosterEntry;
  rank?: number;
}) {
  const href = `${APP}?q=${encodeURIComponent(entry.name)}`;
  return (
    <a className="person-card glass" href={href}>
      {rank != null && <span className="pc-rank">{rank}</span>}
      <Monogram name={entry.name} className="pc-portrait" />
      <span className="pc-name">{entry.name}</span>
      <span className="pc-desc">{entry.descriptor}</span>
      <span className="pc-foot">
        <span>
          b. <b>{entry.born}</b>
        </span>
        <span>
          Open in app <b aria-hidden="true">&rarr;</b>
        </span>
      </span>
    </a>
  );
}
