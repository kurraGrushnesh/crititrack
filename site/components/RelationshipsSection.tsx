"use client";

import { useMemo, useState } from "react";
import {
  RELATIONSHIP_METHODOLOGY_VERSION,
  categoryOf,
  defaultRelationshipFilters,
  filterRelationships,
  relationshipCoverage,
  relationshipTypeLabel,
  searchRelationships,
  type EntityRelationship,
  type RelationshipCategory,
  type RelationshipConfidence,
  type RelationshipFilters,
  type RelationshipStatus,
} from "@/lib/relationships";
import SaveToResearchButton from "./SaveToResearchButton";

/**
 * The Relationships section on a profile — documented connections only.
 * Every card traces to a structured Wikidata claim or a dated career
 * row; a relationship with no source is never shown. Co-occurrence in
 * news is only ever an evidence count, never the basis for a card.
 */

const CATEGORY_FILTERS: { key: RelationshipCategory | "ALL"; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "PERSONAL", label: "Personal" },
  { key: "PROFESSIONAL", label: "Professional" },
  { key: "BUSINESS", label: "Business" },
  { key: "ORGANIZATIONAL", label: "Organizational" },
  { key: "SPORTS", label: "Sports" },
  { key: "OTHER", label: "Other" },
];

const STATUS_FILTERS: { key: RelationshipStatus | "ALL"; label: string }[] = [
  { key: "ALL", label: "Any status" },
  { key: "ACTIVE", label: "Active" },
  { key: "HISTORICAL", label: "Historical" },
  { key: "ENDED", label: "Ended" },
  { key: "UNCERTAIN", label: "Uncertain" },
];

const CONFIDENCE_FILTERS: { key: RelationshipConfidence | "ALL"; label: string }[] = [
  { key: "ALL", label: "Any confidence" },
  { key: "HIGH", label: "High" },
  { key: "MEDIUM", label: "Medium" },
  { key: "LOW", label: "Low" },
];

function RelationshipCard({ r, entityId }: { r: EntityRelationship; entityId: string | null }) {
  const [open, setOpen] = useState(false);
  const dates =
    r.effectiveFrom != null
      ? `${r.effectiveFrom}${r.effectiveTo != null ? `–${r.effectiveTo}` : r.status === "ACTIVE" ? "–present" : ""}`
      : r.effectiveTo != null
        ? `until ${r.effectiveTo}`
        : null;

  return (
    <div className={`rel-card rel-conf-${r.confidence.toLowerCase()}`}>
      <button type="button" className="rel-card-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="rel-type">{relationshipTypeLabel(r.relationshipType)}</span>
        <span className="rel-object">{r.objectName}</span>
        <span className="rel-status">{r.status}</span>
      </button>
      {open && (
        <div className="rel-card-body">
          <p className="rel-flow">
            {r.subjectName} <span aria-hidden="true">→</span> {relationshipTypeLabel(r.relationshipType)}{" "}
            <span aria-hidden="true">→</span> {r.objectName}
          </p>
          <p className="rel-meta">
            {dates && <span>Dates: {dates}</span>}
            <span>Confidence: {r.confidence}</span>
            <span>
              Evidence: {r.sourceUrls.length} source{r.sourceUrls.length === 1 ? "" : "s"}
              {r.evidenceIds.length > 0 && ` · ${r.evidenceIds.length} corroborating item(s)`}
            </span>
            {r.firstObservedAt && <span>First documented: {r.firstObservedAt}</span>}
          </p>
          {r.sourceUrls.length > 0 && (
            <p className="rel-sources">
              {r.sourceUrls.map((u, i) => (
                <a key={u} href={u} target="_blank" rel="noopener noreferrer nofollow">
                  Source {i + 1} →
                </a>
              ))}
            </p>
          )}
          {r.evidenceIds.length > 0 && (
            <a href="#evidence-explorer" className="cv-evidence-link">
              View evidence ({r.evidenceIds.length}) →
            </a>
          )}
          <SaveToResearchButton
            item={{
              type: "RELATIONSHIP",
              entityId,
              title: `${relationshipTypeLabel(r.relationshipType)} ${r.objectName}`,
              summary: `${r.subjectName} — ${relationshipTypeLabel(r.relationshipType)} — ${r.objectName}${dates ? ` (${dates})` : ""}`,
              referenceId: r.relationshipId,
              metadata: {
                relationshipType: r.relationshipType,
                objectEntityId: r.objectEntityId,
                confidence: r.confidence,
                status: r.status,
                sourceCount: r.sourceUrls.length,
              },
            }}
          />
        </div>
      )}
    </div>
  );
}

export default function RelationshipsSection({
  relationships,
  entityId,
}: {
  relationships: EntityRelationship[];
  entityId: string | null;
}) {
  const [filters, setFilters] = useState<RelationshipFilters>(defaultRelationshipFilters());
  const [query, setQuery] = useState("");
  const coverage = useMemo(() => relationshipCoverage(relationships), [relationships]);

  const shown = useMemo(
    () => searchRelationships(filterRelationships(relationships, filters), query),
    [relationships, filters, query],
  );

  if (relationships.length === 0) {
    return (
      <p className="state-block">
        <span className="sb-title">No documented relationships available</span>
        CritiTrack surfaces a relationship only when a structured record
        (Wikidata claim, dated career entry) documents it. Absence here means
        nothing has been retrieved — not that none exist.
      </p>
    );
  }

  const grouped = new Map<RelationshipCategory, EntityRelationship[]>();
  for (const r of shown) {
    const cat = categoryOf(r.relationshipType);
    grouped.set(cat, [...(grouped.get(cat) ?? []), r]);
  }

  return (
    <div className="rel-section">
      <p className="rel-coverage">
        {coverage.total} documented relationship{coverage.total === 1 ? "" : "s"} · {coverage.high} high, {coverage.medium} medium,{" "}
        {coverage.low} low confidence · {coverage.supportingSources} supporting source
        {coverage.supportingSources === 1 ? "" : "s"}
      </p>

      <div className="rel-controls">
        <input type="search" placeholder="Search relationships…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as RelationshipStatus | "ALL" }))}>
          {STATUS_FILTERS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <select value={filters.confidence} onChange={(e) => setFilters((f) => ({ ...f, confidence: e.target.value as RelationshipConfidence | "ALL" }))}>
          {CONFIDENCE_FILTERS.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="cv-filters">
        {CATEGORY_FILTERS.map((c) => (
          <button
            key={c.key}
            type="button"
            className={`cv-filter ${filters.category === c.key ? "is-active" : ""}`}
            onClick={() => setFilters((f) => ({ ...f, category: c.key }))}
          >
            {c.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="cv-empty">No relationships match these filters.</p>
      ) : (
        [...grouped.entries()].map(([cat, list]) => (
          <div key={cat} className="rel-group">
            <h4>{cat.charAt(0) + cat.slice(1).toLowerCase()}</h4>
            {list.map((r) => (
              <RelationshipCard key={r.relationshipId} r={r} entityId={entityId} />
            ))}
          </div>
        ))
      )}

      <p className="dc-footnote">
        Relationships are derived from public structured records on every load
        — never edited, never inferred from name, profession, country, or a
        shared article. Methodology {RELATIONSHIP_METHODOLOGY_VERSION}.
      </p>
    </div>
  );
}
