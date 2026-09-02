import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import CategoryRail from "@/components/CategoryRail";
import CategoryBrowser from "@/components/CategoryBrowser";
import ContextPanel from "@/components/ContextPanel";
import {
  CATEGORY_SLUGS,
  categoryBySlug,
  rosterFor,
} from "@/lib/catalog";

export const dynamicParams = false;

export function generateStaticParams() {
  return CATEGORY_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const cat = categoryBySlug(slug);
  return {
    title: cat ? cat.label : "Category",
    description: cat
      ? `${cat.blurb} A curated Top 10 by public prominence, with filters and person cards.`
      : undefined,
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cat = categoryBySlug(slug);
  if (!cat) notFound();

  const count = rosterFor(slug).length;

  return (
    <>
      <SiteNav />
      <header className="app-hero">
        <div className="wrap">
          <div className="breadcrumb">
            <Link href="/explore">Explore</Link>
            <span>/</span>
            <span>{cat.label}</span>
          </div>
          <h1>{cat.label}</h1>
          <p className="lede">{cat.blurb}</p>
          <CategoryRail active={slug} />
        </div>
      </header>

      <div className="app-shell has-panel">
        <main id="main">
          <p className="sub" style={{ marginTop: 4 }}>
            {count} figures in the catalogue. Prominence order is editorial;
            scores, confidence and evidence come from a live analysis when you
            open a profile.
          </p>
          <CategoryBrowser slug={slug} />
        </main>

        <ContextPanel categorySlug={slug} />
      </div>
      <SiteFooter />
    </>
  );
}
