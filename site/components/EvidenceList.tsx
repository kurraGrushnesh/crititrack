import type { EvidenceFragment } from "@/lib/demo-data";

/**
 * Evidence fragments: short quoted spans from retrieved coverage, tagged
 * by which source type they came from. These are what a sentiment score
 * is built from, shown so the score is inspectable rather than asserted.
 */
export default function EvidenceList({
  items,
}: {
  items: EvidenceFragment[];
}) {
  if (items.length === 0) {
    return <p className="no-records">No evidence fragments recorded.</p>;
  }
  return (
    <ul className="evidence-list">
      {items.map((e, i) => (
        <li key={i}>
          <span className="ev-source">{e.source}</span>
          <span className="ev-frag">&ldquo;{e.fragment}&rdquo;</span>
        </li>
      ))}
    </ul>
  );
}
