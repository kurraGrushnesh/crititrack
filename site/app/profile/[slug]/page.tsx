import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PillNav from "@/components/PillNav";
import SiteFooter from "@/components/SiteFooter";
import ControversyIndexGauge from "@/components/ControversyIndexGauge";
import ControversyRecord from "@/components/ControversyRecord";
import SentimentTrend from "@/components/SentimentTrend";
import EvidenceList from "@/components/EvidenceList";
import WatchButton from "@/components/WatchButton";
import ConfidenceMeter, {
  confidenceLabel,
} from "@/components/ConfidenceMeter";
import ScoreBreakdown from "@/components/ScoreBreakdown";
import StatTable from "@/components/StatTable";
import { DEMO_PROFILES, demoProfileBySlug } from "@/lib/demo-data";
import { corroborated } from "@/lib/controversy";
import { computeControversyIndex, roundedScore } from "@/lib/controversy-index";

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

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
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
      <PillNav />

      <main id="main">
        <div className="profile-head">
          <div>
            <div className="breadcrumb">
              <Link href="/">Home</Link>
              <span>/</span>
              <span>{p.name}</span>
            </div>
            <h1>{p.name}</h1>
            <p className="subtitle">
              {p.profession} · illustrative composite
            </p>

            <StatTable
              stats={[
                { k: "Index", v: roundedScore(index) },
                { k: "Sentiment", v: p.sentimentScore },
                { k: "Records", v: kept.length },
                { k: "Confidence", v: confidenceLabel(p.confidence) },
              ]}
            />

            <div style={{ marginTop: 24 }}>
              <WatchButton slug={p.slug} name={p.name} />
            </div>
          </div>

          <div className="portrait-frame">
            <span className="mono-xl">{initials(p.name)}</span>
          </div>
        </div>

        <div className="min-section" style={{ paddingTop: 8 }}>
          <div className="disclaimer">
            <strong>Fabricated composite.</strong> {p.name} is not a real
            person. Every record, score and source below is invented to show
            how a real profile is laid out. Open the app to run a live,
            sourced analysis of a real figure.
          </div>
          <p style={{ color: "var(--text-soft)" }}>{p.summary}</p>
        </div>

        <hr className="divider-rule" />

        <section className="min-section">
          <div className="head">
            <h2>Controversy Index</h2>
            <Link href="/controversy-index">How it is calculated</Link>
          </div>
          <ControversyIndexGauge index={index} />
        </section>

        <hr className="divider-rule" />

        <section className="min-section">
          <div className="head">
            <h2>Score breakdown</h2>
          </div>
          <p className="sub" style={{ marginBottom: 24 }}>
            The overall sentiment score is a reach-weighted blend of
            per-source scores. Confidence is how much the three scoring
            methods agreed.
          </p>
          <div className="record" style={{ display: "grid", gap: 20 }}>
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

        <hr className="divider-rule" />

        <section className="min-section">
          <div className="head">
            <h2>Sentiment trend</h2>
            <Link href={`/profile/${p.slug}/evidence`}>Evidence fragments</Link>
          </div>
          <div className="record">
            <SentimentTrend
              points={p.trend}
              current={p.sentimentScore}
              direction={p.trendDirection}
            />
            <p className="form-note" style={{ marginTop: 12 }}>
              A query over stored dated snapshots, not a forecast.
            </p>
          </div>
        </section>

        <hr className="divider-rule" />

        <section className="min-section">
          <div className="head">
            <h2>Documented controversies</h2>
          </div>
          <p className="sub" style={{ marginBottom: 24 }}>
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

        <hr className="divider-rule" />

        <section className="min-section">
          <div className="head">
            <h2>Evidence</h2>
          </div>
          <EvidenceList items={p.evidence} />
        </section>

        <hr className="divider-rule" />

        <section className="min-section">
          <div className="head">
            <h2>Related composites</h2>
          </div>
          <div className="person-grid">
            {related.map((r) => (
              <Link
                key={r.slug}
                href={`/profile/${r.slug}`}
                className="person-card"
              >
                <span className="pc-name">{r.name}</span>
                <span className="pc-desc">{r.profession}</span>
              </Link>
            ))}
          </div>
          <p className="form-note" style={{ marginTop: 24 }}>
            Something here wrong?{" "}
            <Link href={`/report-correction?slug=${p.slug}`}>
              Report a correction
            </Link>
            .
          </p>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
