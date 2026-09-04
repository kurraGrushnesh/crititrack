"use client";

import { useRouter } from "next/navigation";
import type { ProfileCandidate } from "@/lib/api";

/**
 * "Which person are you looking for?" — shown when the backend could not
 * confidently decide which real person a name refers to (two notable
 * people share it, or the name only loosely matched).
 *
 * Every card is a real Wikidata person the name could mean; picking one
 * re-runs the lookup pinned to that person's stable id. Nothing here is
 * invented — a field the record does not carry is simply left off.
 */
export default function DisambiguationChooser({
  query,
  best,
  candidates,
}: {
  query: string;
  /** The backend's top guess, offered as the first card. */
  best: ProfileCandidate;
  /** The other people the name could mean. */
  candidates: ProfileCandidate[];
}) {
  const router = useRouter();
  const open = (c: ProfileCandidate) => {
    const p = new URLSearchParams({ q: c.name || query });
    if (c.qid) p.set("qid", c.qid);
    router.push(`/figure/?${p.toString()}`);
  };

  const all = [best, ...candidates].filter(
    (c, i, xs) => c.name && xs.findIndex((x) => x.qid === c.qid) === i,
  );

  return (
    <main id="main" className="page-fade min-section" style={{ paddingTop: 72 }}>
      <div className="breadcrumb">
        <span>Search</span>
        <span>/</span>
        <span>{query}</span>
      </div>
      <h1 style={{ marginBottom: 8 }}>Which person are you looking for?</h1>
      <p className="sub" style={{ marginBottom: 28, maxWidth: "52ch" }}>
        More than one public figure is known as “{query}”. Pick the one you
        meant and CritiTrack will build that profile.
      </p>

      <ul className="disambig-list">
        {all.map((c) => (
          <li key={c.qid ?? c.name}>
            <button type="button" onClick={() => open(c)} className="disambig-card">
              <span className="disambig-photo" aria-hidden="true">
                {c.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.imageUrl} alt="" loading="lazy" />
                ) : (
                  <span>{c.name.slice(0, 1)}</span>
                )}
              </span>
              <span className="disambig-body">
                <span className="disambig-name">{c.name}</span>
                {c.description && (
                  <span className="disambig-desc">{c.description}</span>
                )}
                <span className="disambig-meta">
                  {[
                    c.occupation,
                    c.country,
                    c.birthYear ? `b. ${c.birthYear}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
