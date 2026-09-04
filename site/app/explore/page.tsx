import type { Metadata } from "next";
import PillNav from "@/components/PillNav";
import SiteFooter from "@/components/SiteFooter";
import ExploreCategories from "@/components/ExploreCategories";
import { CATEGORIES } from "@/lib/categories";

export const metadata: Metadata = {
  title: "Explore Categories",
  description:
    "Browse public figures by profession — 35 categories built on CritiTrack's global taxonomy, with a real person-count for each.",
};

export default function ExplorePage() {
  return (
    <>
      <PillNav />
      <header className="app-hero">
        <div className="wrap">
          <div className="breadcrumb">
            <span>Explore</span>
          </div>
          <h1>Explore Categories</h1>
          <p className="lede">
            {CATEGORIES.length} categories, built on CritiTrack&rsquo;s global
            profession taxonomy. A person can appear in more than one — the
            same profile, tagged by everything they are actually known for.
          </p>
        </div>
      </header>

      <main id="main" className="min-section">
        <ExploreCategories />
      </main>
      <SiteFooter />
    </>
  );
}
