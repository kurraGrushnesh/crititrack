import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import ControversyIndexGauge from "@/components/ControversyIndexGauge";
import ControversyRecord from "@/components/ControversyRecord";
import SentimentTrend from "@/components/SentimentTrend";
import EvidenceList from "@/components/EvidenceList";
import WatchButton from "@/components/WatchButton";
import ConfidenceMeter from "@/components/ConfidenceMeter";
import ScoreBreakdown from "@/components/ScoreBreakdown";
import ContextPanel from "@/components/ContextPanel";
import Monogram from "@/components/Monogram";
import { DEMO_PROFILES, demoProfileBySlug } from "@/lib/demo-data";
import { corroborated } from "@/lib/controversy";
import { computeControversyIndex } from "@/lib/controversy-index";

export const dynamicParams = false;

export function generateStaticParams() {
  return DEMO_PROFILES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = demoProfileBySlug(slug);
  if (!p) return { title: "Profile not found" };
  return {
    title: `${p.name} (illustrative)`,
    description: `An illustrative CritiTrack profile for ${p.name}: ${p.summary}`,
  };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = demoProfileBySlug(slug);
  if (!p) notFound();

  const kept = corroborated(p.controversies);
  const dropped = p.controversies.length - kept.length;
  const index = computeControversyIndex(kept);
  const related = DEMO_PROFILES.filter((d) => d.slug !== p.slug);

  return (
    <>
      <SiteNav />
      <header className="app-hero">
        <div className="wrap">
          <div className="breadcrumb">
            <Link href="/explore">Explore</Link>
            <span>/</span>
            <span>{p.name}</span>
          </div>
          <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
            <Monogram name={p.name} size={64} />
            <div>
              <h1 style={{ marginBottom: 4 }}>{p.name}</h1>
              <p className="lede" style={{ margin: 0 }}>
                {p.profession} · illustrative composite
              </p>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <WatchButton slug={p.slug} name={p.name} />
          </div>
        </div>
      </header>

      <div className="app-shell has-panel">
        <main id="main">
          <div className="disclaimer">
            <strong>Fabricated composite.</strong> {p.name} is not a real
            person. Every record, score and source below is invented to show
            how a real profile is laid out. Open the app to run a live,
            sourced analysis of a real figure.
          </div>

          <p style={{ color: "var(--text-soft)" }}>{p.summary}</p>

          <div className="section-gap">
            <ControversyIndexGauge index={index} />
          </div>

          <section className="app-section">
            <h2>Score breakdown</h2>
            <p className="sub">
              The overall sentiment score is a reach-weighted blend of
              per-source scores. Confidence is how much the three scoring
              methods agreed.
            </p>
            <div className="record glass" style={{ display: "grid", gap: 20 }}>
              <ScoreBreakdown
                overall={p.sentimentScore}
                parts={[
                  { label: "News", value: p.scoreNews },
                  { label: "YouTube", value: p.scoreYoutube },
                ]}
              />
              <ConfidenceMeter value={p.confidence} />
            </div>
          </section>

          <section className="app-section">
            <h2>Sentiment trend</h2>
            <div className="record glass">
              <SentimentTrend
                points={p.trend}
                current={p.sentimentScore}
                direction={p.trendDirection}
              />
              <p className="form-note" style={{ marginTop: 12 }}>
                A query over stored dated snapshots, not a forecast.{" "}
                <Link href={`/profile/${p.slug}/evidence`}>
                  See the evidence fragments
                </Link>
                .
              </p>
            </div>
          </section>

          <section className="app-section">
            <h2>Documented controversies</h2>
            <p className="sub">
              {kept.length} shown, sorted by severity.{" "}
              {dropped > 0
                ? `${dropped} severity 4-5 ${
                    dropped === 1 ? "claim was" : "claims were"
                  } dropped for having no corroborating source.`
                : "Every record cites at least one source."}
            </p>
            {kept.length === 0 ? (
              <p className="state-block">
                <span className="sb-title">No documented controversies</span>
                Nothing met the bar for a typed, sourced record.
              </p>
            ) : (
              [...kept]
                .sort((a, b) => b.severity - a.severity)
                .map((c, i) => <ControversyRecord key={i} item={c} />)
            )}
          </section>

          <section className="app-section">
            <h2>Evidence</h2>
            <EvidenceList items={p.evidence} />
          </section>

          <section className="app-section">
            <h2>Related composites</h2>
            <div className="person-grid">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/profile/${r.slug}`}
                  className="person-card glass"
                >
                  <Monogram name={r.name} className="pc-portrait" />
                  <span className="pc-name">{r.name}</span>
                  <span className="pc-desc">{r.profession}</span>
                </Link>
              ))}
            </div>
          </section>

          <p className="form-note app-section">
            Something here wrong?{" "}
            <Link href={`/report-correction?slug=${p.slug}`}>
              Report a correction
            </Link>
            .
          </p>
        </main>

        <ContextPanel />
      </div>
      <SiteFooter />
    </>
  );
}
