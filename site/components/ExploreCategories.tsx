"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ROSTER } from "@/lib/catalog";
import { CATEGORIES, categoryCounts, type DiscoveryCategory } from "@/lib/categories";

/**
 * The category discovery surface: featured categories, a full 35-category
 * grid, and a client-side search over their labels and blurbs. Every
 * count is a real tally of today's roster — a category nobody is
 * catalogued under yet still shows honestly as 0, not hidden and not
 * padded.
 */
export default function ExploreCategories() {
  const counts = useMemo(() => categoryCounts(ROSTER), []);
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const matches = (c: DiscoveryCategory) =>
    q.length === 0 ||
    c.label.toLowerCase().includes(q) ||
    c.blurb.toLowerCase().includes(q);

  const featured = CATEGORIES.filter((c) => c.featured && matches(c));
  const rest = CATEGORIES.filter((c) => !c.featured && matches(c)).sort((a, b) =>
    a.label.localeCompare(b.label),
  );
  const totalShown = featured.length + rest.length;

  return (
    <div className="explore-cats">
      <label className="explore-search">
        <svg viewBox="0 0 20 20" aria-hidden="true" width="16" height="16">
          <circle cx="9" cy="9" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <line x1="14" y1="14" x2="18" y2="18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search categories — e.g. AI, journalism, sports"
          aria-label="Search categories"
        />
      </label>

      {totalShown === 0 ? (
        <p className="state-block">
          <span className="sb-title">No matching categories</span>
          Try a different word — categories are named after real professions
          and industries, not the people in them.
        </p>
      ) : (
        <>
          {featured.length > 0 && (
            <section aria-labelledby="explore-featured">
              <h2 id="explore-featured" className="explore-h2">
                Featured
              </h2>
              <div className="explore-grid">
                {featured.map((c) => (
                  <CategoryCard key={c.slug} category={c} count={counts[c.slug] ?? 0} />
                ))}
              </div>
            </section>
          )}

          <section aria-labelledby="explore-all">
            <h2 id="explore-all" className="explore-h2">
              All categories
            </h2>
            <div className="explore-grid">
              {rest.map((c) => (
                <CategoryCard key={c.slug} category={c} count={counts[c.slug] ?? 0} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function CategoryCard({
  category,
  count,
}: {
  category: DiscoveryCategory;
  count: number;
}) {
  return (
    <Link href={`/category/${category.slug}`} className="category-card glass">
      <span className="cc-top">
        <span className="cc-name">{category.label}</span>
        <span className="cc-count">{count === 1 ? "1 person" : `${count} people`}</span>
      </span>
      <span className="cc-blurb">{category.blurb}</span>
    </Link>
  );
}
