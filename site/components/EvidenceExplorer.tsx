"use client";

import { useMemo, useState } from "react";
import {
  buildEvidenceItems,
  conflictingControversies,
  SOURCE_TYPE_LABEL,
  EVIDENCE_METHODOLOGY_VERSION,
  type EvidenceItem,
  type EvidenceCategory,
  type SourceType,
} from "@/lib/evidence";
import type { MediaLink, EvidenceFragment } from "@/lib/api";
import type { Controversy } from "@/lib/controversy";
import type { CareerEntry } from "@/lib/career";
import SaveToResearchButton from "./SaveToResearchButton";

/**
 * Evidence & Source Explorer — every source this profile's record is
 * actually built from, normalised into one filterable list. Nothing
 * here is fetched separately: it is derived from the same `media`,
 * `controversies` and `career` data the rest of the page already holds.
 *
 * Evidence strength is a read of real signals already on each item
 * (independent-publisher count, whether it is a structured citation vs.
 * a news report) — never a verdict on whether a claim is true, and kept
 * apart from sentiment and from raw coverage volume.
 */

const STRENGTH_LABEL: Record<EvidenceItem["evidenceStrength"], string> = {
  strong: "Strong",
  moderate: "Moderate",
  limited: "Limited",
  conflicting: "Conflicting",
  insufficient: "Insufficient",
};

const FILTERS: { key: "all" | EvidenceCategory; label: string }[] = [
  { key: "all", label: "All" },
  { key: "controversy", label: "Controversies" },
  { key: "career", label: "Career" },
  { key: "news", label: "News" },
];

export default function EvidenceExplorer({
  media,
  controversies,
  career,
  sentimentEvidence,
  entityId,
}: {
  media: MediaLink[];
  controversies: Controversy[];
  career: CareerEntry[];
  sentimentEvidence: EvidenceFragment[];
  /** The profile this evidence belongs to — passed through to "Save to
   * research" so a saved item keeps its entity. */
  entityId?: string | null;
}) {
  const items = useMemo(
    () => buildEvidenceItems({ media, controversies, career, sentimentEvidence }),
    [media, controversies, career, sentimentEvidence],
  );
  const conflicts = useMemo(() => conflictingControversies(items), [items]);

  const [category, setCategory] = useState<"all" | EvidenceCategory>("all");
  const [sourceType, setSourceType] = useState<"all" | SourceType>("all");
  const [query, setQuery] = useState("");

  const sourceTypesPresent = useMemo(
    () => [...new Set(items.map((i) => i.sourceType))],
    [items],
  );

  const q = query.trim().toLowerCase();
  const filtered = items.filter((i) => {
    if (category !== "all" && i.category !== category) return false;
    if (sourceType !== "all" && i.sourceType !== sourceType) return false;
    if (q && !i.title.toLowerCase().includes(q) && !i.sourceName.toLowerCase().includes(q)) {
      return false;
    }
    return true;
  });

  if (items.length === 0) {
    return (
      <p className="state-block">
        <span className="sb-title">No supporting source found</span>
        Nothing has been retrieved for this profile yet that carries a
        source. Reload once fresh coverage has been fetched.
      </p>
    );
  }

  return (
    <div className="ev-explorer" id="evidence">
      {conflicts.length > 0 && (
        <div className="ev-conflict-note">
          <strong>Conflicting evidence.</strong> Coverage of{" "}
          {conflicts.map((c, i) => (
            <span key={c}>
              {i > 0 ? ", " : ""}
              <em>{c}</em>
            </span>
          ))}{" "}
          is not unanimous — outlets characterised it differently. The
          disagreement is shown, not resolved for you.
        </div>
      )}

      <div className="ev-controls">
        <div className="filter-bar" role="group" aria-label="Record type">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={category === f.key}
              onClick={() => setCategory(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        {sourceTypesPresent.length > 1 && (
          <div className="filter-bar" role="group" aria-label="Source type">
            <button
              type="button"
              aria-pressed={sourceType === "all"}
              onClick={() => setSourceType("all")}
            >
              Any source
            </button>
            {sourceTypesPresent.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={sourceType === t}
                onClick={() => setSourceType(t)}
              >
                {SOURCE_TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        )}
        <label className="ev-search">
          <svg viewBox="0 0 20 20" aria-hidden="true" width="14" height="14">
            <circle cx="9" cy="9" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <line x1="14" y1="14" x2="18" y2="18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search evidence..."
            aria-label="Search evidence"
          />
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="state-block">
          <span className="sb-title">No matches</span>
          Nothing in this view matches that filter and search. Try All or clear
          the search.
        </p>
      ) : (
        <ul className="ev-cards">
          {filtered.map((e) => (
            <EvidenceCard key={e.evidenceId} item={e} entityId={entityId} />
          ))}
        </ul>
      )}
      <p className="dc-footnote" style={{ marginTop: 14 }}>
        Evidence methodology v{EVIDENCE_METHODOLOGY_VERSION}.{" "}
        <a href="/methodology#evidence">How this is calculated →</a>
      </p>
    </div>
  );
}

function EvidenceCard({
  item: e,
  entityId,
}: {
  item: EvidenceItem;
  entityId?: string | null;
}) {
  return (
    <li className="ev-card">
      <div className="ev-card-top">
        <span className={`ev-strength is-${e.evidenceStrength}`}>
          {STRENGTH_LABEL[e.evidenceStrength]}
        </span>
        <span className="ev-type">{SOURCE_TYPE_LABEL[e.sourceType]}</span>
      </div>
      <p className="ev-title">{e.title}</p>
      <p className="ev-meta">
        {e.sourceName}
        {e.publicationDate ? ` · ${e.publicationDate}` : ""}
        {e.independentSourceCount != null && e.independentSourceCount > 1
          ? ` · ${e.duplicateCount} article${e.duplicateCount === 1 ? "" : "s"} from ${e.independentSourceCount} independent publishers`
          : ""}
      </p>
      {e.snippet && <p className="ev-snippet">&ldquo;{e.snippet}&rdquo;</p>}
      <p className="ev-reason">{e.strengthReason}</p>
      {e.relatedControversies.length > 0 && (
        <p className="ev-related">Related: {e.relatedControversies.join(", ")}</p>
      )}
      {e.sourceUrl ? (
        <a
          className="ev-open"
          href={e.sourceUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
        >
          Open source →
        </a>
      ) : (
        <span className="ev-open is-disabled">No direct link on file</span>
      )}
      <SaveToResearchButton
        item={{
          type: "EVIDENCE",
          entityId: entityId ?? null,
          title: e.title,
          summary: e.strengthReason,
          referenceId: e.evidenceId,
          metadata: {
            confidence: e.evidenceStrength,
            sourceType: e.sourceType,
            sourceName: e.sourceName,
            sourceUrl: e.sourceUrl,
            publicationDate: e.publicationDate,
          },
        }}
      />
    </li>
  );
}
