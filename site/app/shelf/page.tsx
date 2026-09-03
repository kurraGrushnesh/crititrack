import type { Metadata } from "next";
import PillNav from "@/components/PillNav";
import SiteFooter from "@/components/SiteFooter";
import Shelf from "@/components/shelf/Shelf";

export const metadata: Metadata = {
  title: "The shelf",
  description:
    "Every figure CritiTrack tracks, as a volume on a shelf. Pull one down to open its record.",
};

export default function ShelfPage() {
  return (
    <>
      <PillNav />
      <main id="main">
        <div className="shelf-head">
          <p className="section-label">The shelf</p>
          <h1>Every figure is a volume.</h1>
          <p>
            One book per person CritiTrack follows, its spine keyed to the
            field they are known for. Pull one down to open its record —
            biography, Controversy Index, sentiment, coverage.
          </p>
        </div>
        <Shelf />
      </main>
      <SiteFooter />
    </>
  );
}
