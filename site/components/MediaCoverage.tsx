"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { MediaLink } from "@/lib/api";
import { relativeTime, latestOf } from "@/lib/time";
import { parseSafeUrl, displayHost } from "@/lib/safe-url";
import { sentimentColorVar } from "@/lib/sentiment";

type Filter = "all" | "news" | "video";

function isVideo(m: MediaLink): boolean {
  return m.type === "youtube" || m.type === "video";
}

function plural(n: number, one: string): string {
  return `${n} ${one}${n === 1 ? "" : "s"}`;
}

function NewsGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        d="M5 4h11a1 1 0 0 1 1 1v13a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2V4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M7.5 8.5h6M7.5 12h6M7.5 15.5h4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
function VideoGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <rect
        x="3"
        y="6"
        width="18"
        height="12"
        rx="2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M10 9.5l5 2.5-5 2.5Z" fill="currentColor" />
    </svg>
  );
}

export default function MediaCoverage({ items }: { items: MediaLink[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const { news, videos, latest } = useMemo(() => {
    const v = items.filter(isVideo);
    return {
      news: items.filter((m) => !isVideo(m)),
      videos: v,
      latest: latestOf(items.map((m) => m.publishedAt)),
    };
  }, [items]);

  if (items.length === 0) return null;

  const tabs = (
    [
      { key: "all", label: "All", n: items.length },
      { key: "news", label: "News", n: news.length },
      { key: "video", label: "Videos", n: videos.length },
    ] satisfies { key: Filter; label: string; n: number }[]
  ).filter((t) => t.n > 0);

  const shown =
    filter === "news" ? news : filter === "video" ? videos : items;

  const summary = [
    news.length > 0 && plural(news.length, "article"),
    videos.length > 0 && plural(videos.length, "video"),
    latest && `latest ${relativeTime(latest)}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="media">
      <p className="media-summary">{summary}</p>

      {tabs.length > 1 && (
        <div className="media-tabs" role="tablist" aria-label="Coverage type">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={filter === t.key}
              className={`media-tab${filter === t.key ? " is-active" : ""}`}
              onClick={() => setFilter(t.key)}
            >
              {t.label} <span className="media-tab-n">{t.n}</span>
            </button>
          ))}
        </div>
      )}

      <ul className="media-list">
        {shown.map((m) => (
          <MediaCard key={m.id} m={m} />
        ))}
      </ul>
    </div>
  );
}

/**
 * An image that falls back to `placeholder` if the URL fails to load —
 * dead news thumbnails and pulled videos are common, and a broken-image
 * icon looks worse than an intentional glyph.
 */
function ThumbImg({
  src,
  placeholder,
}: {
  src: string | null;
  placeholder: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <>{placeholder}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function ExtGlyph() {
  return (
    <svg
      className="media-ext"
      viewBox="0 0 24 24"
      width="14"
      height="14"
      aria-hidden="true"
    >
      <path
        d="M14 5h5v5M19 5l-8 8M11 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ScorePill({ m }: { m: MediaLink }) {
  if (m.sentimentScore == null) return null;
  const score = Math.round(m.sentimentScore);
  return (
    <span
      className="media-score"
      style={{ color: sentimentColorVar(score) }}
      title={`Sentiment ${score}${m.sentimentTag ? ` · ${m.sentimentTag}` : ""}`}
    >
      {score}
    </span>
  );
}

/**
 * One card for every item — news and video alike: a 16:9 thumbnail that
 * leads, then the title and a meta line. Video gets a play badge; the
 * source line is the channel for a video, the publication for news.
 */
function MediaCard({ m }: { m: MediaLink }) {
  const href = parseSafeUrl(m.url);
  const thumb = parseSafeUrl(m.thumbnailUrl);
  const when = m.publishedAt ? relativeTime(m.publishedAt) : "";
  const video = isVideo(m);
  const source = video
    ? (m.channel ?? "YouTube")
    : m.source || displayHost(m.url) || "News";

  return (
    <li className="media-card">
      <a
        className="media-card-thumb"
        href={href ? href.toString() : undefined}
        target="_blank"
        rel="noopener noreferrer nofollow"
        aria-label={m.title}
        tabIndex={-1}
      >
        <ThumbImg
          src={thumb ? thumb.toString() : null}
          placeholder={
            <span className="media-card-glyph">
              {video ? <VideoGlyph /> : <NewsGlyph />}
            </span>
          }
        />
        {video && (
          <span className="media-video-play" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22">
              <path d="M8 5v14l11-7Z" fill="currentColor" />
            </svg>
          </span>
        )}
      </a>
      <div className="media-card-body">
        <a
          className="media-title"
          href={href ? href.toString() : undefined}
          target="_blank"
          rel="noopener noreferrer nofollow"
        >
          {m.title}
          <ExtGlyph />
        </a>
        <div className="media-meta">
          <span className="media-source">{source}</span>
          {when && <span className="media-when">· {when}</span>}
          <ScorePill m={m} />
        </div>
      </div>
    </li>
  );
}
