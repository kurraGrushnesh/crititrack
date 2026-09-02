import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { DEMO_PROFILES } from "@/lib/demo-data";
import { corroborated } from "@/lib/controversy";
import { computeControversyIndex, roundedScore } from "@/lib/controversy-index";

export const metadata: Metadata = {
  title: "Explore",
  description:
    "Illustrative CritiTrack profiles, each scored by the deterministic Controversy Index and the shared sentiment bands.",
};

export default function ExplorePage() {
  return (
    <>
      <SiteNav />
      <main id="main" className="page">
        <div className="page-head">
          <h1>Explore</h1>
          <p>
            Each card shows the deterministic Controversy Index and the
            current sentiment score. Open one to see the typed records and
            the evidence behind the numbers.
          </p>
        </div>

        <div className="disclaimer">
          <strong>These are fabricated composites, not real people.</strong>{" "}
          This site is a static export with no backend, so it cannot show a
          live profile. The figures exist only to demonstrate the format.
        </div>

        <div className="profile-grid">
          {DEMO_PROFILES.map((p) => {
            const index = computeControversyIndex(
              corroborated(p.controversies),
            );
            return (
              <Link
                key={p.slug}
                href={`/profile/${p.slug}`}
                className="profile-card"
              >
                <span className="pc-role">{p.profession}</span>
                <span className="pc-name">{p.name}</span>
                <p style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>
                  {index.label}
                </p>
                <div className="pc-metrics">
                  <span className="metric">
                    <span className="m-value">{roundedScore(index)}</span>
                    <span className="m-label">Index</span>
                  </span>
                  <span className="metric">
                    <span className="m-value">{p.sentimentScore}</span>
                    <span className="m-label">Sentiment</span>
                  </span>
                  <span className="metric">
                    <span className="m-value">{index.total}</span>
                    <span className="m-label">Records</span>
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
