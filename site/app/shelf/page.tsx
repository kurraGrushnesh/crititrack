import type { Metadata } from "next";
import PillNav from "@/components/PillNav";
import SiteFooter from "@/components/SiteFooter";
import Shelf from "@/components/shelf/Shelf";
import { SHELF_FIGURES } from "@/components/shelf/shelf-data";

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
        <header className="shelf-head">
          <div className="shelf-head-top">
            <p className="shelf-head-title">The Shelf</p>
            <p className="shelf-head-meta">
              Live index
              <span>Typed · Dated · Sourced</span>
            </p>
          </div>
          <h1>Every figure is a volume.</h1>
          <p className="shelf-head-lede">
            {SHELF_FIGURES.length} books, one per person CritiTrack follows —
            the spine keyed to the field they are known for. Drag the shelf.
            Pull a book down to open its record: biography, Controversy Index,
            sentiment, coverage.
          </p>
        </header>
        <Shelf />
      </main>
      <SiteFooter />
    </>
  );
}
