"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import PillNav from "@/components/PillNav";
import SiteFooter from "@/components/SiteFooter";
import ControversyIndexGauge from "@/components/ControversyIndexGauge";
import ControversyRecord from "@/components/ControversyRecord";
import WatchButton from "@/components/WatchButton";
import { confidenceLabel } from "@/components/ConfidenceMeter";
import SentimentPanel from "@/components/SentimentPanel";
import AttentionChart from "@/components/AttentionChart";
import { Stat, StatRow } from "@/components/Stat";
import MediaCoverage from "@/components/MediaCoverage";
import BioSection from "@/components/BioSection";
import {
  FigureSkeleton,
  FigureNotFound,
  FigureError,
} from "@/components/FigureStates";
import Button from "@/components/Button";
import Reveal from "@/components/Reveal";
import { computeControversyIndex, roundedScore } from "@/lib/controversy-index";
import { useCelebrity } from "@/lib/use-celebrity";
import type { RealProfile } from "@/lib/api";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function SearchPrompt() {
  return (
    <div className="min-section" style={{ paddingTop: 96, textAlign: "center" }}>
      <h1 style={{ fontSize: "clamp(2rem, 1rem + 4vw, 3.2rem)", margin: 0 }}>
        Search a public figure
      </h1>
      <p style={{ color: "var(--text-soft)", marginTop: 16 }}>
        Use the search in the bar above. Every profile is built live from
        sourced coverage — bio, Controversy Index, sentiment, evidence.
      </p>
      <p style={{ marginTop: 24 }}>
        <Button href="/category/actors" variant="subtle">
          Browse by category
        </Button>
      </p>
    </div>
  );
}


function ProfileView({ profile }: { profile: RealProfile }) {
  const index = useMemo(
    () => computeControversyIndex(profile.controversies),
    [profile.controversies],
  );
  const kept = profile.controversies;
  const fetched = new Date(profile.fetchedAt);
  const sentimentCounts = useMemo(() => {
    const fromRatio = (r: number | null) =>
      r != null && profile.sampleSize != null
        ? Math.round(r * profile.sampleSize)
        : 0;
    return {
      positive: profile.positiveCount ?? fromRatio(profile.positiveRatio),
      neutral: profile.neutralCount ?? fromRatio(profile.neutralRatio),
      negative: profile.negativeCount ?? fromRatio(profile.negativeRatio),
    };
  }, [profile]);

  return (
    <main id="main" className="page-fade figure-main">
      <div className="profile-head">
        <div>
          <div className="breadcrumb">
            <Link href="/">Home</Link>
            <span>/</span>
            <span>{profile.name}</span>
          </div>
          <h1>{profile.name}</h1>
          <p className="subtitle">{profile.profession || "Public figure"}</p>

          <StatRow>
            <Stat label="Index" value={roundedScore(index)} />
            <Stat
              label="Sentiment"
              value={Math.round(profile.sentimentScore)}
            />
            <Stat label="Records" value={kept.length} />
            <Stat
              label="Confidence"
              compact
              value={
                profile.confidenceLabel ??
                (profile.confidence != null
                  ? confidenceLabel(profile.confidence)
                  : "—")
              }
            />
          </StatRow>

          <div style={{ marginTop: 24 }}>
            <WatchButton slug={profile.slug} name={profile.name} />
          </div>
        </div>

        <div className="portrait-frame">
          {profile.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.imageUrl}
              alt={profile.name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span className="mono-xl">{initials(profile.name)}</span>
          )}
        </div>
      </div>

      {(profile.summary || profile.notableWorks.length > 0) && (
        <div className="min-section" style={{ paddingTop: 8 }}>
          <BioSection
            profile={profile}
            fetchedLabel={fetched.toLocaleDateString()}
            correctionHref={`/report-correction?slug=${profile.slug}`}
          />
        </div>
      )}

      <Reveal>
        <hr className="divider-rule" />
        <section className="min-section">
          <div className="head">
            <h2>Controversy Index</h2>
            <Link href="/controversy-index">How it is calculated</Link>
          </div>
          <ControversyIndexGauge index={index} />
        </section>
      </Reveal>

      <Reveal>
        <hr className="divider-rule" />
        <section className="min-section">
          <div className="head">
            <h2>Sentiment analysis</h2>
          </div>
          <SentimentPanel profile={profile} counts={sentimentCounts} />
        </section>
      </Reveal>

      {profile.attention && profile.attention.series.length > 1 && (
        <Reveal>
          <hr className="divider-rule" />
          <section className="min-section">
            <div className="head">
              <h2>Public attention</h2>
            </div>
            <AttentionChart data={profile.attention} />
          </section>
        </Reveal>
      )}

      <Reveal>
        <hr className="divider-rule" />
        <section className="min-section">
          <div className="head">
            <h2>Documented controversies</h2>
          </div>
          {kept.length === 0 ? (
            <p className="state-block">
              <span className="sb-title">No documented controversies</span>
              Nothing in the retrieved coverage met the bar for a typed,
              sourced record.
            </p>
          ) : (
            <>
              <p className="sub" style={{ marginBottom: 24 }}>
                {kept.length} shown, sorted by severity. Severity 4–5 claims
                with no corroborating source are dropped before they reach
                this list.
              </p>
              {[...kept]
                .sort((a, b) => b.severity - a.severity)
                .map((c, i) => (
                  <ControversyRecord key={i} item={c} />
                ))}
            </>
          )}
        </section>
      </Reveal>

      {profile.media.length > 0 && (
        <Reveal>
          <hr className="divider-rule" />
          <section className="min-section">
            <div className="head">
              <h2>Media coverage</h2>
            </div>
            <MediaCoverage items={profile.media} />
          </section>
        </Reveal>
      )}
    </main>
  );
}

function FigureInner() {
  const params = useSearchParams();
  const router = useRouter();
  const q = params.get("q")?.trim() ?? "";
  const { state, retry } = useCelebrity(q || null);

  if (!q) {
    return (
      <>
        <PillNav />
        <SearchPrompt />
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <PillNav />

      {state.status === "loading" && <FigureSkeleton name={q} />}

      {state.status === "ready" && <ProfileView profile={state.profile} />}

      {state.status === "not-found" && (
        <FigureNotFound
          message={state.message}
          onHome={() => router.push("/")}
        />
      )}

      {state.status === "error" && (
        <FigureError
          message={state.message}
          canRetry={state.canRetry}
          onRetry={retry}
        />
      )}

      <SiteFooter />
    </>
  );
}

export default function FigurePage() {
  return (
    <Suspense
      fallback={
        <>
          <PillNav />
          <FigureSkeleton name="…" />
        </>
      }
    >
      <FigureInner />
    </Suspense>
  );
}
