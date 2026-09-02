"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import PillNav from "@/components/PillNav";
import SiteFooter from "@/components/SiteFooter";
import ControversyIndexGauge from "@/components/ControversyIndexGauge";
import ControversyRecord from "@/components/ControversyRecord";
import SentimentTrend from "@/components/SentimentTrend";
import EvidenceList from "@/components/EvidenceList";
import WatchButton from "@/components/WatchButton";
import ConfidenceMeter, { confidenceLabel } from "@/components/ConfidenceMeter";
import ScoreBreakdown from "@/components/ScoreBreakdown";
import StatTable from "@/components/StatTable";
import ClassificationPanel from "@/components/ClassificationPanel";
import { buildClassification } from "@/lib/classification";
import { computeControversyIndex, roundedScore } from "@/lib/controversy-index";
import { displayHost, parseSafeUrl } from "@/lib/safe-url";
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
        <Link href="/category/actors" className="pillnav-cta">
          Browse by category
        </Link>
      </p>
    </div>
  );
}

function ProfileSkeleton({ name }: { name: string }) {
  return (
    <main id="main" aria-busy="true">
      <div className="profile-head">
        <div>
          <div className="breadcrumb">
            <Link href="/">Home</Link>
            <span>/</span>
            <span>{name}</span>
          </div>
          <h1>{name}</h1>
          <p className="subtitle">Building profile from sourced coverage…</p>
          <div
            className="skeleton"
            style={{ height: 120, marginTop: 40, borderRadius: 4 }}
          />
        </div>
        <div className="portrait-frame">
          <span className="mono-xl">{initials(name)}</span>
        </div>
      </div>
      <div className="min-section">
        <div className="skeleton" style={{ height: 220, borderRadius: 12 }} />
      </div>
      <hr className="divider-rule" />
      <div className="min-section">
        <div className="skeleton" style={{ height: 160, borderRadius: 12 }} />
      </div>
      <p className="form-note" style={{ textAlign: "center", paddingBottom: 40 }}>
        The analysis backend sleeps when idle — the first search after a quiet
        spell can take 20–30 seconds.
      </p>
    </main>
  );
}

function ProfileView({ profile }: { profile: RealProfile }) {
  const index = useMemo(
    () => computeControversyIndex(profile.controversies),
    [profile.controversies],
  );
  const kept = profile.controversies;
  const parts = [
    { label: "News", value: profile.scoreNews },
    { label: "YouTube", value: profile.scoreYoutube },
    { label: "Instagram", value: profile.scoreInstagram },
  ];
  const fetched = new Date(profile.fetchedAt);
  const hasClassification = useMemo(
    () => buildClassification(profile).length > 0,
    [profile],
  );

  return (
    <main id="main" className="page-fade">
      <div className="profile-head">
        <div>
          <div className="breadcrumb">
            <Link href="/">Home</Link>
            <span>/</span>
            <span>{profile.name}</span>
          </div>
          <h1>{profile.name}</h1>
          <p className="subtitle">
            {profile.profession || "Public figure"}
            {profile.verified ? " · resolved on Wikidata" : ""}
          </p>

          <StatTable
            stats={[
              { k: "Index", v: roundedScore(index) },
              { k: "Sentiment", v: Math.round(profile.sentimentScore) },
              { k: "Records", v: kept.length },
              {
                k: "Confidence",
                v:
                  profile.confidenceLabel ??
                  (profile.confidence != null
                    ? confidenceLabel(profile.confidence)
                    : "—"),
              },
            ]}
          />

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

      {profile.summary && (
        <div className="min-section" style={{ paddingTop: 8 }}>
          <p style={{ color: "var(--text-soft)", maxWidth: "68ch" }}>
            {profile.summary}
          </p>
          <p className="form-note" style={{ marginTop: 16 }}>
            Compiled {fetched.toLocaleDateString()} from public coverage.{" "}
            {profile.wikidataId ? `Wikidata ${profile.wikidataId}. ` : ""}
            <Link href={`/report-correction?slug=${profile.slug}`}>
              Report a correction
            </Link>
            .
          </p>
        </div>
      )}

      {hasClassification && (
        <>
          <hr className="divider-rule" />
          <section className="min-section">
            <div className="head">
              <h2>Classification</h2>
              <span
                style={{
                  whiteSpace: "nowrap",
                  fontSize: "0.9rem",
                  color: "var(--text-muted)",
                }}
              >
                from Wikidata
              </span>
            </div>
            <ClassificationPanel profile={profile} />
          </section>
        </>
      )}

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
          <h2>Sentiment</h2>
        </div>
        {profile.explanation && (
          <p className="sub" style={{ marginBottom: 24, maxWidth: "68ch" }}>
            {profile.explanation}
          </p>
        )}
        <div className="record" style={{ display: "grid", gap: 20 }}>
          <ScoreBreakdown overall={profile.sentimentScore} parts={parts} />
          {profile.confidence != null && (
            <ConfidenceMeter value={profile.confidence} />
          )}
        </div>
      </section>

      {profile.trend.length > 1 && (
        <>
          <hr className="divider-rule" />
          <section className="min-section">
            <div className="head">
              <h2>Sentiment trend</h2>
            </div>
            <div className="record">
              <SentimentTrend
                points={profile.trend}
                current={profile.sentimentScore}
                direction={profile.trendDirection}
              />
              <p className="form-note" style={{ marginTop: 12 }}>
                A query over stored dated snapshots, not a forecast.
              </p>
            </div>
          </section>
        </>
      )}

      <hr className="divider-rule" />

      <section className="min-section">
        <div className="head">
          <h2>Documented controversies</h2>
        </div>
        {kept.length === 0 ? (
          <p className="state-block">
            <span className="sb-title">No documented controversies</span>
            Nothing in the retrieved coverage met the bar for a typed, sourced
            record.
          </p>
        ) : (
          <>
            <p className="sub" style={{ marginBottom: 24 }}>
              {kept.length} shown, sorted by severity. Severity 4–5 claims with
              no corroborating source are dropped before they reach this list.
            </p>
            {[...kept]
              .sort((a, b) => b.severity - a.severity)
              .map((c, i) => (
                <ControversyRecord key={i} item={c} />
              ))}
          </>
        )}
      </section>

      {profile.evidence.length > 0 && (
        <>
          <hr className="divider-rule" />
          <section className="min-section">
            <div className="head">
              <h2>Evidence</h2>
            </div>
            <EvidenceList items={profile.evidence} />
          </section>
        </>
      )}

      {profile.media.length > 0 && (
        <>
          <hr className="divider-rule" />
          <section className="min-section">
            <div className="head">
              <h2>Coverage</h2>
            </div>
            <ul className="evidence-list">
              {profile.media.slice(0, 12).map((m) => {
                const safe = parseSafeUrl(m.url);
                return (
                  <li key={m.id}>
                    <span className="ev-source">
                      {m.source || displayHost(m.url) || m.type}
                    </span>
                    <span className="ev-frag">
                      {safe ? (
                        <a
                          className="source-link"
                          href={safe.toString()}
                          rel="noopener noreferrer nofollow"
                          target="_blank"
                        >
                          {m.title}
                        </a>
                      ) : (
                        m.title
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
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

      {state.status === "loading" && <ProfileSkeleton name={q} />}

      {state.status === "ready" && <ProfileView profile={state.profile} />}

      {state.status === "not-found" && (
        <main id="main" className="min-section" style={{ paddingTop: 96 }}>
          <p className="state-block">
            <span className="sb-title">No match</span>
            {state.message}
          </p>
          <p style={{ marginTop: 24 }}>
            <button
              type="button"
              className="pillnav-cta"
              onClick={() => router.push("/")}
            >
              Back to home
            </button>
          </p>
        </main>
      )}

      {state.status === "error" && (
        <main id="main" className="min-section" style={{ paddingTop: 96 }}>
          <p className="state-block">
            <span className="sb-title">Couldn’t load this profile</span>
            {state.message}
          </p>
          {state.canRetry && (
            <p style={{ marginTop: 24 }}>
              <button type="button" className="pillnav-cta" onClick={retry}>
                Try again
              </button>
            </p>
          )}
        </main>
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
          <ProfileSkeleton name="…" />
        </>
      }
    >
      <FigureInner />
    </Suspense>
  );
}
