"use client";

import { Suspense, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import PillNav from "@/components/PillNav";
import SiteFooter from "@/components/SiteFooter";
import ControversyIndexGauge from "@/components/ControversyIndexGauge";
import IndexExplanation from "@/components/IndexExplanation";
import IndexHistoryChart from "@/components/IndexHistoryChart";
import ControversyRecord from "@/components/ControversyRecord";
import WatchButton from "@/components/WatchButton";
import { confidenceLabel } from "@/components/ConfidenceMeter";
import ConfidenceBadge from "@/components/ConfidenceBadge";
import SentimentPanel from "@/components/SentimentPanel";
import AttentionChart from "@/components/AttentionChart";
import FigureTimeline from "@/components/FigureTimeline";
import ProfileLinks from "@/components/ProfileLinks";
import DisambiguationChooser from "@/components/DisambiguationChooser";
import ProfessionalIdentity from "@/components/ProfessionalIdentity";
import CareerSection from "@/components/CareerSection";
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
import { sentimentConfidence } from "@/lib/confidence";
import { parseProfileHash } from "@/lib/deep-link";
import { relativeTime } from "@/lib/time";
import { useCelebrity } from "@/lib/use-celebrity";
import type { RealProfile, ProfileCandidate } from "@/lib/api";

/** The current profile expressed as a chooser card (the "best guess"). */
function selfCandidate(p: RealProfile): ProfileCandidate {
  return {
    name: p.name,
    qid: p.wikidataId,
    description: p.profession || undefined,
    occupation: p.professional?.primary?.label || undefined,
    imageUrl: p.imageUrl,
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


function ProfileView({
  profile,
  cachedAt,
}: {
  profile: RealProfile;
  cachedAt?: number;
}) {
  const index = useMemo(
    () => computeControversyIndex(profile.controversies),
    [profile.controversies],
  );

  // Deep links: after the profile renders, jump to the section,
  // controversy anchor or timeline day named in the URL fragment.
  useEffect(() => {
    const parsed = parseProfileHash(window.location.hash);
    const id =
      parsed.section ??
      parsed.controversyAnchor ??
      (parsed.eventDate ? `event-${parsed.eventDate}` : null);
    if (!id) return;
    const t = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    }, 120);
    return () => window.clearTimeout(t);
  }, [profile.slug]);
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

  const sentimentBadge = sentimentConfidence(profile.confidence ?? NaN);

  return (
    <main id="main" className="page-fade figure-main">
      {cachedAt != null && (
        <div className="cached-notice" role="status">
          <span aria-hidden="true">⚑</span>
          <span>
            Showing a copy saved {relativeTime(new Date(cachedAt).toISOString())}
            . The backend could not be reached, so this is not live — reload
            when you are back online.
          </span>
        </div>
      )}
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

      {profile.accounts.length > 0 && (
        <div className="figure-accounts">
          <ProfileLinks accounts={profile.accounts} />
        </div>
      )}

      <ProfessionalIdentity identity={profile.professional} />

      <CareerSection career={profile.career} />

      {(profile.summary || profile.notableWorks.length > 0) && (
        <div className="min-section" id="summary" style={{ paddingTop: 8 }}>
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
          <ControversyIndexGauge index={index} controversies={profile.controversies} />
          <IndexHistoryChart controversies={profile.controversies} />
          <IndexExplanation controversies={profile.controversies} />
        </section>
      </Reveal>

      <Reveal>
        <hr className="divider-rule" />
        <section className="min-section" id="sentiment">
          <div className="head">
            <h2>Sentiment analysis</h2>
            {profile.confidence != null && (
              <ConfidenceBadge badge={sentimentBadge} />
            )}
          </div>
          <SentimentPanel profile={profile} counts={sentimentCounts} />
        </section>
      </Reveal>

      {profile.timeline.length > 0 && (
        <Reveal>
          <hr className="divider-rule" />
          <section className="min-section" id="timeline">
            <div className="head">
              <h2>Timeline</h2>
            </div>
            <p className="sub" style={{ marginBottom: 24 }}>
              Controversies, career and organisation changes, clustered news
              coverage, attention spikes and sharp sentiment moves, on one
              axis. An attention spike is unsigned — people looked, with no
              direction implied.
            </p>
            <FigureTimeline events={profile.timeline} />
          </section>
        </Reveal>
      )}

      {profile.attention && profile.attention.series.length > 1 && (
        <Reveal>
          <hr className="divider-rule" />
          <section className="min-section" id="attention">
            <div className="head">
              <h2>Public attention</h2>
            </div>
            <AttentionChart data={profile.attention} />
          </section>
        </Reveal>
      )}

      <Reveal>
        <hr className="divider-rule" />
        <section className="min-section" id="controversies">
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
          <section className="min-section" id="coverage">
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
  const qid = params.get("qid")?.trim() ?? "";
  const { state, retry } = useCelebrity(q || null, qid || undefined);

  // The searcher pinned a specific person, or the backend was confident:
  // show the profile. Only step in when resolution is genuinely unclear
  // and there are real alternatives to offer.
  const needsChoice =
    state.status === "ready" &&
    !qid &&
    (state.profile.resolution === "ambiguous" ||
      state.profile.resolution === "low") &&
    state.profile.candidates.length > 0;

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

      {state.status === "ready" && needsChoice && (
        <DisambiguationChooser
          query={q}
          best={selfCandidate(state.profile)}
          candidates={state.profile.candidates}
        />
      )}

      {state.status === "ready" && !needsChoice && (
        <ProfileView profile={state.profile} cachedAt={state.cachedAt} />
      )}

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
