"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import PillNav from "@/components/PillNav";
import SiteFooter from "@/components/SiteFooter";
import SaveToResearchButton from "@/components/SaveToResearchButton";
import { useCompare } from "@/lib/use-compare";
import { keyDifferences, turningPointsFor, type ComparisonDataMode, type ComparisonTopic } from "@/lib/compare";
import { directRelationshipsBetween, sharedConnections, relationshipTypeLabel } from "@/lib/relationships";
import { HISTORICAL_RANGE_LABEL, type HistoricalTimeRange } from "@/lib/historical";

const TOPIC_FILTERS: { key: ComparisonTopic; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "CRITISCORE", label: "CritiScore" },
  { key: "SENTIMENT", label: "Sentiment" },
  { key: "ATTENTION", label: "Attention" },
  { key: "CAREER", label: "Career" },
  { key: "ORGANIZATION", label: "Organizations" },
  { key: "CONTROVERSY", label: "Controversies" },
  { key: "CLAIMS", label: "Claims" },
  { key: "NEWS", label: "News" },
];

const DATA_MODE_FILTERS: { key: ComparisonDataMode; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "HIGH_CONFIDENCE", label: "High confidence" },
  { key: "MEDIUM_PLUS", label: "Medium+" },
  { key: "EVIDENCE_BACKED", label: "Evidence-backed only" },
];

const RANGE_FILTERS: HistoricalTimeRange[] = ["30d", "90d", "1y", "3y", "5y", "all"];

function CompareInner() {
  const params = useSearchParams();
  const id = params.get("id");
  const { state, rename, setFilters, setTimeRange } = useCompare(id);
  const [editingTitle, setEditingTitle] = useState(false);

  if (!id) return <p className="state-block">No comparison selected.</p>;
  if (state.status === "loading") return <p className="state-block">Resolving both entities…</p>;
  if (state.status === "error") return <p className="state-block">{state.message}</p>;

  const { comparison, contextA, contextB, sections } = state.value;

  if (!contextA || !contextB) {
    return (
      <p className="state-block">
        <span className="sb-title">Could not load one of these entities</span>
        The comparison record is saved, but one of its resolved entities
        could not be fetched just now. Try again later.
      </p>
    );
  }

  const diffs = keyDifferences(sections, 5);
  const [pointsA, pointsB] = turningPointsFor(contextA, contextB);
  const directRels = directRelationshipsBetween(contextA.relationships, contextB.entityId, contextB.entityName);
  const shared = sharedConnections(contextA.relationships, contextB.relationships);

  return (
    <div className="cmp-view">
      <div className="cmp-header">
        {editingTitle ? (
          <input
            autoFocus
            defaultValue={comparison.title}
            onBlur={(e) => {
              setEditingTitle(false);
              if (e.target.value.trim()) rename(e.target.value);
            }}
          />
        ) : (
          <h1 onClick={() => setEditingTitle(true)}>{comparison.title}</h1>
        )}
      </div>

      <div className="cmp-headers">
        {[contextA, contextB].map((c) => (
          <div key={c.entityId} className="cmp-entity-card">
            <h2>{c.entityName}</h2>
            {c.profession && <p className="cmp-entity-meta">{c.profession}</p>}
            {c.currentRole && <p className="cmp-entity-meta">{c.currentRole}</p>}
            <p className="cmp-entity-meta">
              CritiScore: {c.critiScore != null ? Math.round(c.critiScore) : "Unavailable"}
              {c.critiScoreBand ? ` (${c.critiScoreBand})` : ""}
            </p>
            <p className="cmp-entity-meta">
              Sentiment: {c.sentimentScore != null ? Math.round(c.sentimentScore) : "Unavailable"}
              {c.sentimentBand ? ` (${c.sentimentBand})` : ""}
            </p>
          </div>
        ))}
      </div>

      <div className="cmp-summary">
        <h3>Relationship</h3>
        {directRels.length > 0 ? (
          <ul>
            {directRels.map((r) => (
              <li key={r.relationshipId}>
                {contextA.entityName} — {relationshipTypeLabel(r.relationshipType)} — {contextB.entityName}
                {" · "}
                {r.confidence.toLowerCase()} confidence
              </li>
            ))}
          </ul>
        ) : (
          <p className="rel-shared">No documented direct relationship found in the available data.</p>
        )}
        {shared.length > 0 && (
          <p className="rel-shared">
            <strong>Shared organization{shared.length === 1 ? "" : "s"}:</strong>{" "}
            {shared.map((s) => `${s.organizationName} (${relationshipTypeLabel(s.aType)} / ${relationshipTypeLabel(s.bType)})`).join("; ")}. This is a
            shared affiliation, not a direct relationship.
          </p>
        )}
      </div>

      {diffs.length > 0 && (
        <div className="cmp-summary">
          <h3>Key differences</h3>
          <ul>
            {diffs.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="cmp-controls">
        <div className="cv-filters">
          {RANGE_FILTERS.map((r) => (
            <button
              key={r}
              type="button"
              className={`cv-filter ${comparison.timeRange === r ? "is-active" : ""}`}
              onClick={() => setTimeRange(r)}
            >
              {HISTORICAL_RANGE_LABEL[r]}
            </button>
          ))}
        </div>
        <div className="cv-filters">
          {TOPIC_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`cv-filter ${comparison.filters.topic === f.key ? "is-active" : ""}`}
              onClick={() => setFilters({ topic: f.key })}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="cv-filters">
          {DATA_MODE_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`cv-filter ${comparison.filters.dataMode === f.key ? "is-active" : ""}`}
              onClick={() => setFilters({ dataMode: f.key })}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {sections.length === 0 ? (
        <p className="state-block">No comparison data matches the current filters.</p>
      ) : (
        <div className="cmp-sections">
          {sections.map((s) => (
            <section key={s.topic + s.title} className="cmp-section">
              <h3>{s.title}</h3>
              <table className="cmp-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>{contextA.entityName}</th>
                    <th>{contextB.entityName}</th>
                  </tr>
                </thead>
                <tbody>
                  {s.rows.map((r) => (
                    <tr key={r.rowId}>
                      <td>{r.metric}</td>
                      <td>{r.valueA}</td>
                      <td>{r.valueB}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {s.rows.some((r) => r.note) && (
                <ul className="cmp-notes">
                  {s.rows
                    .filter((r) => r.note)
                    .map((r) => (
                      <li key={r.rowId}>{r.note}</li>
                    ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      {(pointsA.points.length > 0 || pointsB.points.length > 0) && (
        <div className="cmp-turning-points">
          <h3>Turning points</h3>
          {[pointsA, pointsB].map((p) => (
            <div key={p.entityId}>
              <h4>{p.entityName}</h4>
              <ul>
                {p.points.map((tp) => (
                  <li key={tp.id}>
                    {tp.date} — {tp.title}
                  </li>
                ))}
                {p.points.length === 0 && <li className="cmp-notes">No turning points identified.</li>}
              </ul>
            </div>
          ))}
        </div>
      )}

      <SaveToResearchButton
        item={{
          type: "ENTITY",
          entityId: contextA.entityId,
          title: `${contextA.entityName} vs ${contextB.entityName}`,
          summary: `Saved comparison: ${comparison.title}`,
          referenceId: comparison.comparisonId,
          metadata: { comparisonId: comparison.comparisonId },
        }}
      />

      <p className="dc-footnote">
        This comparison describes real differences in CritiTrack&rsquo;s
        existing intelligence — it never ranks who is &ldquo;better&rdquo;,
        and unequal data coverage is disclosed rather than treated as a
        result. Methodology {comparison.methodologyVersion}.
      </p>
    </div>
  );
}

export default function CompareViewPage() {
  return (
    <>
      <PillNav />
      <main id="main" className="page">
        <Suspense fallback={<p className="state-block">Loading comparison…</p>}>
          <CompareInner />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
