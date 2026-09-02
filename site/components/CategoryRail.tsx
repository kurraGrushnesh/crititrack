import Link from "next/link";
import { CATEGORIES } from "@/lib/catalog";

/** The six category chips. `active` highlights the current one. */
export default function CategoryRail({ active }: { active?: string }) {
  return (
    <nav className="cat-rail" aria-label="Categories">
      {CATEGORIES.map((c) => (
        <Link
          key={c.slug}
          href={`/category/${c.slug}`}
          className="cat-chip"
          aria-current={active === c.slug ? "page" : undefined}
        >
          {c.label}
        </Link>
      ))}
    </nav>
  );
}
