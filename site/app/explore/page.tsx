import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import AppHero from "@/components/AppHero";
import CategoryRail from "@/components/CategoryRail";
import ContextPanel from "@/components/ContextPanel";
import PersonCard from "@/components/PersonCard";
import Reveal from "@/components/Reveal";
import { CATEGORIES, topTen } from "@/lib/catalog";
import { DEMO_PROFILES } from "@/lib/demo-data";
import { corroborated } from "@/lib/controversy";
import { computeControversyIndex, roundedScore } from "@/lib/controversy-index";

export const metadata: Metadata = {
  title: "Explore",
  description:
    "Search a public figure, browse by category, and open a sourced, evidence-linked profile in the CritiTrack app.",
};

const FEATURED = [
  "Serena Williams",
  "Barack Obama",
  "Taylor Swift",
  "Satya Nadella",
  "Zendaya",
  "MrBeast",
];

export default function ExplorePage() {
  return (
    <>
      <SiteNav />
      <AppHero
        title="What has this person actually been criticised for?"
        lede="Search a name and open a structured profile in the app — every serious claim typed, dated, severity-scored, and backed by a source. Or browse by category below."
      >
        <CategoryRail />
      </AppHero>

      <div className="app-shell has-panel">
        <main id="main">
          <section className="app-section"><Reveal>
            <h2>Browse by category</h2>
            <p className="sub">
              Each category has a curated Top 10 by public prominence, filters,
              and person cards.
            </p>
            <div className="person-grid">
              {CATEGORIES.map((c) => {
                const lead = topTen(c.slug)[0];
                return (
                  <Link
                    key={c.slug}
                    href={`/category/${c.slug}`}
                    className="person-card glass"
                  >
                    <span className="pc-name">{c.label}</span>
                    <span className="pc-desc">{c.blurb}</span>
                    <span className="pc-foot">
                      <span>
                        Top 10 &middot; leads with <b>{lead?.name}</b>
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </Reveal></section>

          <section className="app-section"><Reveal>
            <h2>Featured figures</h2>
            <p className="sub">
              A cross-section of the catalogue. Opening a card runs a live,
              sourced analysis in the app.
            </p>
            <div className="person-grid">
              {FEATURED.map((name) => {
                const entry = CATEGORIES.flatMap((c) => topTen(c.slug)).find(
                  (r) => r.name === name,
                );
                return entry ? (
                  <PersonCard key={name} entry={entry} />
                ) : null;
              })}
            </div>
          </Reveal></section>

          <section className="app-section"><Reveal>
            <h2>How a profile is built</h2>
            <p className="sub">
              The format, shown on three fabricated composites so nothing here
              is a claim about a real person.
            </p>
            <div className="person-grid">
              {DEMO_PROFILES.map((p) => {
                const index = computeControversyIndex(
                  corroborated(p.controversies),
                );
                return (
                  <Link
                    key={p.slug}
                    href={`/profile/${p.slug}`}
                    className="person-card glass"
                  >
                    <span className="pc-name">{p.name}</span>
                    <span className="pc-desc">
                      {p.profession} · illustrative composite
                    </span>
                    <span className="pc-foot">
                      <span>
                        Index <b>{roundedScore(index)}</b>
                      </span>
                      <span>
                        Sentiment <b>{p.sentimentScore}</b>
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </Reveal></section>

          <section className="app-section">
            <Reveal>
              <p className="form-note">
                New here?{" "}
                <Link href="/methodology">Read how the pipeline works</Link>, or
                see{" "}
                <Link href="/controversy-index">
                  how the deterministic index is calculated
                </Link>
                .
              </p>
            </Reveal>
          </section>
        </main>

        <ContextPanel />
      </div>
      <SiteFooter />
    </>
  );
}
