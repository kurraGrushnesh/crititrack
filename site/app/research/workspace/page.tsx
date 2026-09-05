"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import PillNav from "@/components/PillNav";
import SiteFooter from "@/components/SiteFooter";
import Button from "@/components/Button";
import { useWorkspace } from "@/lib/use-research";
import { useReports } from "@/lib/use-report";
import { overviewCounts, evidenceQualitySummary, type ResearchItemType, type FindingStatus } from "@/lib/research";
import { relativeTime } from "@/lib/time";

const TYPE_FILTERS: { key: ResearchItemType | "ALL"; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "ENTITY", label: "Entities" },
  { key: "EVIDENCE", label: "Evidence" },
  { key: "CLAIM", label: "Claims" },
  { key: "CONTROVERSY", label: "Controversies" },
  { key: "NEWS_EVENT", label: "News" },
  { key: "TIMELINE_EVENT", label: "Timeline" },
  { key: "CHANGE_EVENT", label: "Changes" },
  { key: "HISTORICAL_EVENT", label: "Historical" },
  { key: "SOURCE", label: "Sources" },
  { key: "NOTE", label: "Notes" },
];

const STATUS_LABEL: Record<FindingStatus, string> = {
  UNDECIDED: "Undecided",
  INCLUDED: "Included",
  EXCLUDED: "Excluded",
  NEEDS_REVIEW: "Needs review",
};

function ItemCard({
  item,
  onStatus,
  onNote,
  onTag,
  onUntag,
  onRemove,
}: {
  item: import("@/lib/research").ResearchItem;
  onStatus: (s: FindingStatus) => void;
  onNote: (n: string) => void;
  onTag: (t: string) => void;
  onUntag: (t: string) => void;
  onRemove: () => void;
}) {
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(item.note);
  const [tagDraft, setTagDraft] = useState("");

  return (
    <div className={`rw-item rw-status-${item.status.toLowerCase()}`}>
      <div className="rw-item-head">
        <span className="rw-item-type">{item.type.replace("_", " ")}</span>
        <span className="rw-item-title">{item.title}</span>
        <select value={item.status} onChange={(e) => onStatus(e.target.value as FindingStatus)}>
          {Object.entries(STATUS_LABEL).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {item.summary && <p className="rw-item-summary">{item.summary}</p>}
      {typeof item.metadata.confidence === "string" && (
        <p className="rw-item-meta">CritiTrack confidence: {item.metadata.confidence}</p>
      )}

      <div className="rw-item-tags">
        {item.tags.map((t) => (
          <span key={t} className="rw-tag">
            {t}
            <button type="button" aria-label={`Remove tag ${t}`} onClick={() => onUntag(t)}>
              ×
            </button>
          </span>
        ))}
        <input
          className="rw-tag-input"
          placeholder="+ tag"
          value={tagDraft}
          onChange={(e) => setTagDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && tagDraft.trim()) {
              onTag(tagDraft.trim());
              setTagDraft("");
            }
          }}
        />
      </div>

      <div className="rw-item-note">
        {editingNote ? (
          <>
            <textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} rows={2} />
            <div className="rw-item-note-actions">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  onNote(noteDraft);
                  setEditingNote(false);
                }}
              >
                Save note
              </Button>
              <Button size="sm" variant="subtle" onClick={() => setEditingNote(false)}>
                Cancel
              </Button>
            </div>
          </>
        ) : item.note ? (
          <p className="rw-note-text" onClick={() => setEditingNote(true)}>
            <span className="rw-note-label">Research note:</span> {item.note}
          </p>
        ) : (
          <button type="button" className="rw-note-add" onClick={() => setEditingNote(true)}>
            + Add research note
          </button>
        )}
      </div>

      <button type="button" className="rw-item-remove" onClick={onRemove}>
        Remove from workspace
      </button>
    </div>
  );
}

function WorkspaceInner() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id");
  const { create: createReport } = useReports(id ?? undefined);
  const {
    state,
    rename,
    addTag,
    removeTag,
    removeItem,
    setStatus,
    setNote,
    typeFilter,
    setTypeFilter,
    sort,
    setSort,
    query,
    setQuery,
    visibleItems,
    loadMore,
  } = useWorkspace(id);
  const [editingTitle, setEditingTitle] = useState(false);

  if (!id) return <p className="state-block">No workspace selected.</p>;
  if (state.status === "loading") return <p className="state-block">Loading workspace…</p>;
  if (state.status === "error") return <p className="state-block">{state.message}</p>;

  const { workspace, items, hasMore } = state.value;
  const counts = overviewCounts(items);
  const quality = evidenceQualitySummary(items);

  return (
    <div className="rw-workspace">
      <div className="rw-header">
        {editingTitle ? (
          <input
            autoFocus
            defaultValue={workspace.title}
            onBlur={(e) => {
              setEditingTitle(false);
              if (e.target.value.trim()) rename(e.target.value);
            }}
          />
        ) : (
          <h1 onClick={() => setEditingTitle(true)}>{workspace.title}</h1>
        )}
        <p className="rw-updated">
          {items.length} item{items.length === 1 ? "" : "s"} · updated {relativeTime(workspace.updatedAt)}
        </p>
        <Button
          variant="primary"
          size="sm"
          onClick={async () => {
            const report = await createReport(workspace);
            router.push(`/research/report?id=${report.reportId}`);
          }}
        >
          Generate report
        </Button>
      </div>

      <div className="rw-overview">
        <span>Entities: {workspace.entityIds.length}</span>
        <span>Evidence: {counts.evidence}</span>
        <span>Claims: {counts.claims}</span>
        <span>Events: {counts.events}</span>
        <span>Sources: {counts.sources}</span>
        <span>Notes: {counts.notes}</span>
      </div>

      {quality.evidenceCollected > 0 && (
        <div className="rw-quality">
          <span>Evidence collected: {quality.evidenceCollected}</span>
          <span>High confidence: {quality.highConfidence}</span>
          <span>Medium: {quality.mediumConfidence}</span>
          <span>Low: {quality.lowConfidence}</span>
          {quality.claimsNeedingReview > 0 && <span>Needs review: {quality.claimsNeedingReview}</span>}
        </div>
      )}

      <div className="rw-controls">
        <input
          type="search"
          placeholder="Search this workspace…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>

      <div className="cv-filters">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`cv-filter ${typeFilter === f.key ? "is-active" : ""}`}
            onClick={() => setTypeFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visibleItems.length === 0 ? (
        <p className="state-block">
          <span className="sb-title">Nothing here yet</span>
          Use &ldquo;Save to research&rdquo; on evidence, claims, controversies,
          or events elsewhere on CritiTrack to collect them here.
        </p>
      ) : (
        <div className="rw-items">
          {visibleItems.map((item) => (
            <ItemCard
              key={item.itemId}
              item={item}
              onStatus={(s) => setStatus(item.itemId, s)}
              onNote={(n) => setNote(item.itemId, n)}
              onTag={(t) => addTag(item.itemId, t)}
              onUntag={(t) => removeTag(item.itemId, t)}
              onRemove={() => removeItem(item.itemId)}
            />
          ))}
        </div>
      )}

      {hasMore && (
        <Button variant="ghost" size="sm" onClick={loadMore}>
          Load more
        </Button>
      )}

      <p className="dc-footnote">
        Statuses (Included / Excluded / Needs Review) and tags are your own
        research decisions — they never change CritiTrack&rsquo;s own
        verification state, confidence, or scores.
      </p>
    </div>
  );
}

export default function ResearchWorkspacePage() {
  return (
    <>
      <PillNav />
      <main id="main" className="page">
        <Suspense fallback={<p className="state-block">Loading workspace…</p>}>
          <WorkspaceInner />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
