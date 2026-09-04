"use client";

import { useMemo, useState } from "react";
import { DECADES, decadeOf, ROSTER, type RosterEntry } from "@/lib/catalog";
import { rosterForCategory, topTenForCategory } from "@/lib/categories";
import PersonCard from "./PersonCard";

/**
 * Category view: a Top 10 (editorial prominence) plus the full roster
 * with a birth-decade filter and a rank/name sort. Client-side so the
 * filters are instant; the data is the static catalogue.
 *
 * `slug` accepts both the 35-category and the 6 legacy slugs —
 * `rosterForCategory` resolves the alias.
 */
export default function CategoryBrowser({ slug }: { slug: string }) {
  const roster = useMemo(() => rosterForCategory(slug, ROSTER), [slug]);
  const top = useMemo(() => topTenForCategory(slug, ROSTER), [slug]);

  const [decade, setDecade] = useState<number | null>(null);
  const [sort, setSort] = useState<"rank" | "name" | "born">("rank");

  const filtered = useMemo(() => {
    let list: RosterEntry[] = roster.map((r) => r);
    if (decade != null) list = list.filter((r) => decadeOf(r.born) === decade);
    if (sort === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "born") list = [...list].sort((a, b) => a.born - b.born);
    return list;
  }, [roster, decade, sort]);

  const availableDecades = useMemo(
    () => DECADES.filter((d) => roster.some((r) => decadeOf(r.born) === d)),
    [roster],
  );

  return (
    <>
      {top.length > 0 && (
        <section className="app-section">
          <h2>Top 10</h2>
          <p className="sub">
            A curated list of prominent figures in this category. The order
            reflects public profile, not any controversy score.
          </p>
          <div className="person-grid">
            {top.map((r, i) => (
              <PersonCard key={r.name} entry={r} rank={i + 1} />
            ))}
          </div>
        </section>
      )}

      <section className="app-section">
        <h2>Everyone in this category</h2>
        <div className="filter-bar" role="group" aria-label="Filters">
          <span className="fb-label">Born</span>
          <button
            type="button"
            aria-pressed={decade === null}
            onClick={() => setDecade(null)}
          >
            Any
          </button>
          {availableDecades.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={decade === d}
              onClick={() => setDecade(d)}
            >
              {d}s
            </button>
          ))}
          <span className="fb-label" style={{ marginLeft: 12 }}>
            Sort
          </span>
          {(["rank", "name", "born"] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={sort === s}
              onClick={() => setSort(s)}
            >
              {s === "rank" ? "Prominence" : s === "name" ? "A–Z" : "Age"}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="state-block">
            <span className="sb-title">
              {roster.length === 0 ? "No one catalogued yet" : "No matches"}
            </span>
            {roster.length === 0
              ? "No one in today's roster resolves to this category. The category itself is real — the catalogue just doesn't have anyone in it yet."
              : `No figures in this category were born in the ${decade}s. Clear the filter to see the full list.`}
          </p>
        ) : (
          <div className="person-grid">
            {filtered.map((r) => (
              <PersonCard
                key={r.name}
                entry={r}
                rank={sort === "rank" ? roster.indexOf(r) + 1 : undefined}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
