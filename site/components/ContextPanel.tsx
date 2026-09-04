import Link from "next/link";
import { ROSTER, type RosterEntry } from "@/lib/catalog";
import {
  CATEGORIES,
  categoryBySlug,
  canonicalCategorySlug,
  topTenForCategory,
} from "@/lib/categories";

const FIGURE = "/figure/";

/**
 * The persistent desktop side panel. Hidden below 1040px (see app.css).
 * Shows the current category's Top 10, the other categories, and a few
 * catalogue stats. Every list here is editorial prominence, not a
 * controversy ranking.
 */
export default function ContextPanel({
  categorySlug,
  relatedTitle,
  related,
}: {
  categorySlug?: string;
  relatedTitle?: string;
  related?: RosterEntry[];
}) {
  const cat = categorySlug ? categoryBySlug(categorySlug) : undefined;
  const top = categorySlug ? topTenForCategory(categorySlug, ROSTER) : [];
  const canonicalActive = categorySlug ? canonicalCategorySlug(categorySlug) : undefined;

  return (
    <aside className="context-panel glass" aria-label="Context">
      {cat && top.length > 0 && (
        <div className="cp-section">
          <h2>{cat.label} — Top 10</h2>
          <ol className="cp-list">
            {top.map((r, i) => (
              <li key={r.name}>
                <a href={`${FIGURE}?q=${encodeURIComponent(r.name)}`}>
                  <span className="cp-rank">{i + 1}</span>
                  <span>{r.name}</span>
                </a>
              </li>
            ))}
          </ol>
          <p className="fine" style={{ marginTop: 8 }}>
            Ordered by public prominence, not by controversy.
          </p>
        </div>
      )}
      {cat && top.length === 0 && (
        <div className="cp-section">
          <h2>{cat.label}</h2>
          <p className="fine">No one in today&rsquo;s roster is catalogued here yet.</p>
        </div>
      )}

      {related && related.length > 0 && (
        <div className="cp-section">
          <h2>{relatedTitle ?? "Related"}</h2>
          <ul className="cp-list">
            {related.map((r) => (
              <li key={r.name}>
                <a href={`${FIGURE}?q=${encodeURIComponent(r.name)}`}>
                  <span>{r.name}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="cp-section">
        <h2>Browse</h2>
        <ul className="cp-list">
          {CATEGORIES.filter((c) => c.featured && c.slug !== canonicalActive).map(
            (c) => (
              <li key={c.slug}>
                <Link href={`/category/${c.slug}`}>
                  <span>{c.label}</span>
                </Link>
              </li>
            ),
          )}
        </ul>
        <p className="fine" style={{ marginTop: 8 }}>
          <Link href="/explore">All {CATEGORIES.length} categories &rarr;</Link>
        </p>
      </div>

      <div className="cp-section">
        <h2>Catalogue</h2>
        <div className="cp-stats">
          <div className="cp-stat">
            <div className="v">{CATEGORIES.length}</div>
            <div className="l">Categories</div>
          </div>
          <div className="cp-stat">
            <div className="v">{ROSTER.length}</div>
            <div className="l">Figures</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
