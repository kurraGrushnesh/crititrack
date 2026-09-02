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

  return (
    <>
      <SiteNav />
      <main id="main" className="page">
        <div className="breadcrumb">
          <Link href="/explore">Explore</Link>
          <span>/</span>
          <span>{p.name}</span>
        </div>

        <div className="page-head">
          <h1>{p.name}</h1>
          <p>
            {p.profession}. {p.summary}
          </p>
          <div style={{ marginTop: 16 }}>
            <WatchButton slug={p.slug} name={p.name} />
          </div>
        </div>

        <div className="disclaimer">
          <strong>Fabricated composite.</strong> {p.name} is not a real
          person. Every record, score and source below is invented to show
          how a real profile is laid out.
        </div>

        <ControversyIndexGauge index={index} />

        <section className="section-gap">
          <h2 style={{ fontSize: "1.35rem", fontWeight: 700, marginBottom: 12 }}>
            Sentiment
          </h2>
          <div className="record">
            <SentimentTrend
              points={p.trend}
              current={p.sentimentScore}
              direction={p.trendDirection}
            />
            <p className="form-note" style={{ marginTop: 12 }}>
              Drawn from stored dated snapshots.{" "}
              <Link href={`/profile/${p.slug}/evidence`}>
                See the evidence fragments
              </Link>
              .
            </p>
          </div>
        </section>

        <section className="section-gap">
          <h2 style={{ fontSize: "1.35rem", fontWeight: 700, marginBottom: 6 }}>
            Documented controversies
          </h2>
          <p className="form-note" style={{ marginBottom: 16 }}>
            {kept.length} shown.{" "}
            {dropped > 0
              ? `${dropped} severity 4-5 ${
                  dropped === 1 ? "claim was" : "claims were"
                } dropped for having no corroborating source.`
              : "Every record cites at least one source."}
          </p>
          {kept.length === 0 ? (
            <p className="no-records">No documented controversies.</p>
          ) : (
            [...kept]
              .sort((a, b) => b.severity - a.severity)
              .map((c, i) => <ControversyRecord key={i} item={c} />)
          )}
        </section>

        <section className="section-gap">
          <h2 style={{ fontSize: "1.35rem", fontWeight: 700, marginBottom: 12 }}>
            Evidence
          </h2>
          <EvidenceList items={p.evidence} />
        </section>

        <p className="form-note section-gap">
          Something here wrong?{" "}
          <Link href={`/report-correction?slug=${p.slug}`}>
            Report a correction
          </Link>
          .
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
