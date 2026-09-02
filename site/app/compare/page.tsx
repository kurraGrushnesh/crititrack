import type { Metadata } from "next";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import CompareView from "@/components/CompareView";

export const metadata: Metadata = {
  title: "Compare",
  description:
    "Put two CritiTrack profiles side by side, scored by the same deterministic index and the same sentiment bands.",
};

export default function ComparePage() {
  return (
    <>
      <SiteNav />
      <main className="page">
        <div className="page-head">
          <h1>Compare</h1>
          <p>
            Both columns use the same deterministic Controversy Index and the
            same sentiment bands, so the numbers are like-for-like.
          </p>
        </div>
        <div className="disclaimer">
          <strong>Fabricated composites.</strong> Neither figure is a real
          person.
        </div>
        <CompareView />
      </main>
      <SiteFooter />
    </>
  );
}
