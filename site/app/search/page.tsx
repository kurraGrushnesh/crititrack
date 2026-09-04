import type { Metadata } from "next";
import PillNav from "@/components/PillNav";
import SiteFooter from "@/components/SiteFooter";
import SearchResults from "@/components/SearchResults";

export const metadata: Metadata = {
  title: "Discover",
  description:
    "Search CritiTrack across people, professions, industries and categories — names, aliases, and natural-language queries like “Indian entrepreneurs” or “technology CEOs”.",
};

export default function SearchPage() {
  return (
    <>
      <PillNav />
      <SearchResults />
      <SiteFooter />
    </>
  );
}
