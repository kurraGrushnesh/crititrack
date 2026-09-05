"use client";

import { useId, useState } from "react";
import SentimentDonut from "./SentimentDonut";
import SentimentTrend from "./SentimentTrend";
import { Stat, StatRow } from "./Stat";
import type { RealProfile } from "@/lib/api";
import {
  sentimentBand,
  sentimentColorVar,
  confidenceExplainer,
} from "@/lib/sentiment";
import { formatCompact, shortDate } from "@/lib/attention";
import { buildSentimentAudit } from "@/lib/methodology";
import AuditMeta from "./AuditMeta";

type Tab = "split" | "trend" | "mentions";

const TREND_ARROW = { up: "↑", down: "↓", stable: "→" } as const;
const TREND_WORD = { up: "Rising", down: "Falling", stable: "Steady" } as const;
const BAND_WORD: Record<ReturnType<typeof sentimentBand>, string> = {
  positive: "Positive",
  mixed: "Mixed",
  negative: "Negative",
};

function cap(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export default function SentimentPanel({
  profile,
  counts,
}: {
  profile: RealProfile;
  counts: { positive: number; neutral: number; negative: number };
}) {
  const [tab, setTab] = useState<Tab>("split");
  const panelId = useId();

  const overall = Math.round(profile.sentimentScore);
  const band = sentimentBand(profile.sentimentScore);
  const color = sentimentColorVar(profile.sentimentScore);

  const sources = [
    { label: "News", value: profile.scoreNews },
    { label: "YouTube", value: profile.scoreYoutube },
    { label: "Instagram", value: profile.scoreInstagram },
  ].filter((x): x is { label: string; value: number } => x.value != null);

  const hasRange =
    profile.scoreLow != null && profile.scoreHigh != null;
  const mentionPts = profile.trend.filter((p) => p.mentions > 0);

  const tabs: { key: Tab; label: string }[] = [
    { key: "split", label: "Sentiment split" },
    { key: "trend", label: "Trend" },
    { key: "mentions", label: "Daily mentions" },
  ];

  return (
    <div className="senti">
      <StatRow>
        <Stat label="Overall" value={overall} sub={BAND_WORD[band]} tone={color} />
        {profile.dominantEmotion && (
          <Stat
            label="Dominant emotion"
            value={cap(profile.dominantEmotion)}
            compact
          />
        )}
        <Stat
          label="Trend"
          compact
          value={
            <>
              <span aria-hidden="true">
                {TREND_ARROW[profile.trendDirection]}
              </span>{" "}
              {TREND_WORD[profile.trendDirection]}
            </>
          }
        />
      </StatRow>

      {profile.confidence != null && (
        <div className="senti-confidence">
          <div className="senti-confidence-line">
            <b>{profile.confidenceLabel ?? "Confidence"}</b>
            {hasRange && (
              <>
                {" · likely "}
                {Math.round(profile.scoreLow!)}–{Math.round(profile.scoreHigh!)}
              </>
            )}
            {profile.sampleSize != null && ` from ${profile.sampleSize} items`}
          </div>
          <p className="senti-confidence-note">
            {confidenceExplainer(profile.confidence)}
          </p>
          {hasRange && (
            <div
              className="senti-range"
              role="img"
              aria-label={`Score ${overall}, likely range ${Math.round(
                profile.scoreLow!,
              )} to ${Math.round(profile.scoreHigh!)} out of 100`}
            >
              <span
                className="senti-range-band"
                style={{
                  left: `${profile.scoreLow}%`,
                  width: `${Math.max(1, profile.scoreHigh! - profile.scoreLow!)}%`,
                }}
              />
              <span
                className="senti-range-mark"
                style={{ left: `${overall}%`, background: color }}
              />
            </div>
          )}
        </div>
      )}

      {sources.length > 0 && (
        <div className="senti-sources">
          <div className="senti-sources-head">
            <span>Source breakdown</span>
            <span className="senti-tag">Algorithmically generated</span>
          </div>
          <StatRow>
            {sources.map((src) => (
              <Stat
                key={src.label}
                label={src.label}
                value={Math.round(src.value)}
                tone={sentimentColorVar(src.value)}
                meter={src.value}
              />
            ))}
          </StatRow>
        </div>
      )}

      <div className="senti-tabs" role="tablist" aria-label="Sentiment detail">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`${panelId}-${t.key}-tab`}
            aria-selected={tab === t.key}
            aria-controls={`${panelId}-${t.key}`}
            className={`senti-tab${tab === t.key ? " is-active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        className="senti-tabpanel"
        role="tabpanel"
        id={`${panelId}-${tab}`}
        aria-labelledby={`${panelId}-${tab}-tab`}
      >
        {tab === "split" &&
          (counts.positive + counts.neutral + counts.negative > 0 ? (
            <SentimentDonut
              positive={counts.positive}
              neutral={counts.neutral}
              negative={counts.negative}
              sampleSize={profile.sampleSize}
            />
          ) : (
            <p className="senti-empty">
              Not enough classified mentions yet to break sentiment down.
            </p>
          ))}

        {tab === "trend" &&
          (profile.trend.length >= 2 ? (
            <SentimentTrend
              points={profile.trend}
              current={profile.sentimentScore}
              direction={profile.trendDirection}
            />
          ) : (
            <p className="senti-empty">
              {profile.trend.length} day recorded so far. A trend line needs
              at least 4.
            </p>
          ))}

        {tab === "mentions" &&
          (mentionPts.length >= 1 ? (
            <MentionBars points={mentionPts} />
          ) : (
            <p className="senti-empty">No dated mention counts recorded yet.</p>
          ))}
      </div>

      {profile.evidence.length > 0 && (
        <details className="senti-evidence">
          <summary>What the model pointed to</summary>
          <ul>
            {profile.evidence.map((e, i) => (
              <li key={i}>
                <span className="senti-evidence-src">{e.source}</span>
                <span>&ldquo;{e.fragment}&rdquo;</span>
              </li>
            ))}
          </ul>
          <a href="#evidence-explorer" className="senti-evidence-link">
            View coverage in the Evidence Explorer →
          </a>
        </details>
      )}

      <details className="senti-methodology">
        <summary>Methodology</summary>
        <div className="senti-methodology-body">
          <AuditMeta meta={buildSentimentAudit(profile)} />
          <ul>
            <li>{profile.sampleSize ?? "No"} analyzed mention{profile.sampleSize === 1 ? "" : "s"}</li>
            <li>
              Method agreement:{" "}
              {profile.methodAgreement != null
                ? `${Math.round(profile.methodAgreement * 100)}% (Available)`
                : "Not available"}
            </li>
            <li>
              {profile.trend.length > 0
                ? `${profile.trend.length}-day trend window`
                : "No historical trend window recorded yet"}
            </li>
          </ul>
          <p className="senti-methodology-note">
            Sentiment measures the tone of analyzed coverage — it is not a
            verdict on any claim. Negative sentiment is not proof of
            wrongdoing; positive sentiment does not disprove an allegation.
          </p>
          <a href="/methodology#sentiment" className="senti-evidence-link">
            Full sentiment methodology →
          </a>
        </div>
      </details>

      {profile.explanation && (
        <div className="senti-analysis">
          <div className="senti-analysis-label">Generated analysis</div>
          <p>{profile.explanation}</p>
        </div>
      )}

      <p className="form-note">Scores and charts are algorithmically generated.</p>
    </div>
  );
}

function MentionBars({
  points,
}: {
  points: { date: string; mentions: number }[];
}) {
  const max = Math.max(1, ...points.map((p) => p.mentions));
  return (
    <div className="mention-bars">
      {points.map((p) => (
        <div key={p.date} className="mention-bar" title={`${p.mentions} mentions · ${shortDate(p.date)}`}>
          <span
            className="mention-bar-fill"
            style={{ height: `${(p.mentions / max) * 100}%` }}
          />
          <span className="mention-bar-value">{formatCompact(p.mentions)}</span>
          <span className="mention-bar-date">{shortDate(p.date)}</span>
        </div>
      ))}
    </div>
  );
}
