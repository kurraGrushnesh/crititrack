"use client";

import { useState } from "react";
import Link from "next/link";
import { demoProfileBySlug } from "@/lib/demo-data";
import { allTags, entriesForTag } from "@/lib/watchlist";
import {
  useWatchlist,
  toggleWatch,
  tagWatch,
  untagWatch,
} from "./watchlist-store";

/**
 * The device-local watchlist, with folder-like tags. Tags are stored on
 * each entry; the bar filters by one, and each card can be tagged or
 * un-tagged inline. Nothing here touches the network.
 */
export default function WatchlistView() {
  const entries = useWatchlist();
  const [active, setActive] = useState<string | "all" | "untagged">("all");
  const [adding, setAdding] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  if (entries.length === 0) {
    return (
      <p className="no-records">
        Your watchlist is empty. Open a profile and choose
        &ldquo;Watch&rdquo; — it is stored only in this browser.
      </p>
    );
  }

  const tags = allTags(entries);
  const shown =
    active === "all"
      ? entries
      : active === "untagged"
        ? entriesForTag(entries, null)
        : entriesForTag(entries, active);

  function submitTag(slug: string) {
    const t = draft.trim();
    if (t) tagWatch(slug, t);
    setDraft("");
    setAdding(null);
  }

  return (
    <>
      {tags.length > 0 && (
        <div className="tag-bar" role="group" aria-label="Filter watchlist by tag">
          {(["all", "untagged"] as const).map((k) => (
            <button
              key={k}
              type="button"
              className={`tag-pill${active === k ? " is-active" : ""}`}
              onClick={() => setActive(k)}
            >
              {k === "all" ? "All" : "Untagged"}
            </button>
          ))}
          {tags.map((t) => (
            <button
              key={t}
              type="button"
              className={`tag-pill${active === t ? " is-active" : ""}`}
              onClick={() => setActive(t)}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      <div className="person-grid">
        {shown.map((e) => {
          const demo = demoProfileBySlug(e.slug);
          const href = demo
            ? `/profile/${e.slug}`
            : `/figure/?q=${encodeURIComponent(e.name)}#change-history`;
          return (
            <div key={e.slug} className="watch-card">
              <Link href={href} className="person-card">
                <span className="pc-name">{e.name}</span>
                <span className="pc-desc">
                  {demo ? `${demo.profession} · illustrative` : "Live profile · view changes"}
                </span>
              </Link>

              <div className="watch-card-tags">
                {e.tags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="watch-card-tag"
                    onClick={() => untagWatch(e.slug, t)}
                    aria-label={`Remove tag ${t} from ${e.name}`}
                  >
                    {t} ×
                  </button>
                ))}
                {adding === e.slug ? (
                  <input
                    autoFocus
                    value={draft}
                    maxLength={30}
                    aria-label={`New tag for ${e.name}`}
                    onChange={(ev) => setDraft(ev.target.value)}
                    onBlur={() => submitTag(e.slug)}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter") submitTag(e.slug);
                      if (ev.key === "Escape") {
                        setDraft("");
                        setAdding(null);
                      }
                    }}
                    style={{ width: 90, font: "inherit" }}
                  />
                ) : (
                  <button
                    type="button"
                    className="watch-card-tag"
                    onClick={() => {
                      setAdding(e.slug);
                      setDraft("");
                    }}
                  >
                    + tag
                  </button>
                )}
              </div>

              <button
                type="button"
                className="watch-remove"
                onClick={() => toggleWatch(e.slug, e.name)}
                aria-label={`Remove ${e.name} from watchlist`}
              >
                Remove
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
