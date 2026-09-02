import type { Metadata } from "next";
import Link from "next/link";
import PillNav from "@/components/PillNav";
import SiteFooter from "@/components/SiteFooter";
import CategoryRail from "@/components/CategoryRail";
import PersonCard from "@/components/PersonCard";
import Reveal from "@/components/Reveal";
import HeroSwitch from "@/components/hero/HeroSwitch";
import { CATEGORIES, topTen } from "@/lib/catalog";
import { DEMO_PROFILES } from "@/lib/demo-data";
import { corroborated } from "@/lib/controversy";
import { computeControversyIndex, roundedScore } from "@/lib/controversy-index";

export const metadata: Metadata = {
  title: "CritiTrack — accountability tracking for public figures",
  description:
    "Search a public figure and open a structured, evidence-linked record: what they were criticised for, how serious it was, and whether sentiment is moving.",
};

const FEATURED = [
  "Serena Williams",
  "Barack Obama",
  "Taylor Swift",
  "Satya Nadella",
  "Zendaya",
  "MrBeast",
];

export default function Home() {
  return (
    <>
      <PillNav />

      <main id="main">
        <div className="display-hero-band">
          <HeroSwitch />
          <header className="display-hero">
            <p className="eyebrow">
              Accountability tracking for public figures
            </p>
            <h1>What have they actually been criticised for?</h1>
            <p className="sub">
              Every serious claim typed, dated, severity-scored, and backed by
              a source. Search a name in the bar above, or start from a
              category.
            </p>
          </header>
        </div>

        <section className="min-section" aria-labelledby="cats">
          <div className="head">
            <h2 id="cats">Categories</h2>
            <Link href="/category/actors">Browse all</Link>
          </div>
          <CategoryRail />
          <div className="person-grid" style={{ marginTop: 24 }}>
            {CATEGORIES.map((c) => {
              const lead = topTen(c.slug)[0];
              return (
                <Link
                  key={c.slug}
                  href={`/category/${c.slug}`}
                  className="person-card"
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
        </section>

        <hr className="divider-rule" />

        <section className="min-section">
          <div className="head">
            <h2>Featured figures</h2>
            <Link href="/category/actors">See more</Link>
          </div>
          <Reveal>
            <div className="person-grid">
              {FEATURED.map((name) => {
                const entry = CATEGORIES.flatMap((c) => topTen(c.slug)).find(
                  (r) => r.name === name,
                );
                return entry ? <PersonCard key={name} entry={entry} /> : null;
              })}
            </div>
          </Reveal>
        </section>

        <hr className="divider-rule" />

        <section className="min-section">
          <div className="head">
            <h2>How a profile is built</h2>
            <Link href="/methodology">Read the method</Link>
          </div>
          <p className="sub" style={{ marginBottom: 24 }}>
            Shown on three fabricated composites, so nothing here is a claim
            about a real person.
          </p>
          <Reveal>
            <div className="person-grid">
              {DEMO_PROFILES.map((p) => {
                const index = computeControversyIndex(
                  corroborated(p.controversies),
                );
                return (
                  <Link
                    key={p.slug}
                    href={`/profile/${p.slug}`}
                    className="person-card"
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
          </Reveal>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
