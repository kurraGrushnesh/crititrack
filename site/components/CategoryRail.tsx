import Link from "next/link";
import { CATEGORIES, canonicalCategorySlug } from "@/lib/categories";

const FEATURED = CATEGORIES.filter((c) => c.featured);

/**
 * The featured-category chips, plus a link to the full 35-category
 * explorer — a flat rail of all of them would not fit. `active` accepts
 * either the new or a legacy slug and highlights the matching chip.
 */
export default function CategoryRail({ active }: { active?: string }) {
  const canonicalActive = active ? canonicalCategorySlug(active) : undefined;
  return (
    <nav className="cat-rail" aria-label="Categories">
      {FEATURED.map((c) => (
        <Link
          key={c.slug}
          href={`/category/${c.slug}`}
          className="cat-chip"
          aria-current={canonicalActive === c.slug ? "page" : undefined}
        >
          {c.label}
        </Link>
      ))}
      <Link href="/explore" className="cat-chip cat-chip-more">
        All categories &rarr;
      </Link>
    </nav>
  );
}
