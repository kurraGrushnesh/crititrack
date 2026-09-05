/**
 * Professional Research Reports — turns a Research Workspace's selected
 * items into a structured, evidence-backed document. Nothing here is a
 * new evidence, verification, or scoring system: a report only
 * organizes and presents what the workspace already collected (itself
 * references into Evidence & Source Explorer, the Claim Verification
 * Matrix, controversy records, and canonical entity data), plus the
 * user's own workspace decisions (which items are Included) and notes.
 *
 * Generation is deterministic template composition over already-real
 * data — never a language model. That is a deliberate choice, not an
 * oversight: the spec allows using the existing Groq infrastructure
 * "if" it is used, but every rule in this module (no invented facts, no
 * invented citations, uncertainty preserved, verification never
 * upgraded) is trivially and provably true of a pure function over
 * structured input, and only probabilistically true of a language
 * model constrained by a prompt. Building it as a template also needs
 * no new backend endpoint, no new external API call, and is fully
 * testable with fixtures — consistent with every deterministic system
 * this product already ships (CritiScore, coverage, claims).
 *
 * A report never re-derives an item's status: everything shown for a
 * claim, a piece of evidence, or a controversy is the snapshot already
 * captured on the `ResearchItem` when it was saved (see
 * `research.ts`'s disclosed "never re-synced automatically"), clearly
 * dated by the item's own `updatedAt`. This is what "never upgrade
 * verification" means in practice: the report has no code path that
 * could change a status, because it never touches the canonical record
 * at all — it only reads the workspace's own copy of it.
 */

import type { CoverageReport } from "./coverage";
import type { HistoricalOverview } from "./historical";
import { METHODOLOGY_SECTIONS, type MethodologySection } from "./methodology";
import type { ResearchItem, ResearchWorkspace } from "./research";

export const REPORT_METHODOLOGY_VERSION = "report-1";

// ── Report model ────────────────────────────────────────────────────

export type ReportStatus = "DRAFT" | "READY" | "ARCHIVED";

export type ReportTemplate =
  | "STANDARD"
  | "ACCOUNTABILITY"
  | "PROFILE_RESEARCH"
  | "HISTORICAL_REVIEW"
  | "COMPARATIVE_RESEARCH";

export interface ResearchReport {
  reportId: string;
  workspaceId: string;
  userId: string;
  title: string;
  subtitle: string;
  description: string;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
  generatedAt: string | null;
  methodologyVersion: string;
  entityIds: string[];
  sectionIds: string[];
  template: ReportTemplate;
  version: number;
}

export function createReport(input: {
  reportId: string;
  workspaceId: string;
  userId: string;
  entityIds: string[];
  title?: string;
  subtitle?: string;
  template?: ReportTemplate;
  now: string;
}): ResearchReport {
  return {
    reportId: input.reportId,
    workspaceId: input.workspaceId,
    userId: input.userId,
    title: input.title?.trim() || "Untitled report",
    subtitle: input.subtitle?.trim() ?? "",
    description: "",
    status: "DRAFT",
    createdAt: input.now,
    updatedAt: input.now,
    generatedAt: null,
    methodologyVersion: REPORT_METHODOLOGY_VERSION,
    entityIds: input.entityIds,
    sectionIds: [],
    template: input.template ?? "STANDARD",
    version: 1,
  };
}

export function renameReport(r: ResearchReport, title: string, now: string): ResearchReport {
  const trimmed = title.trim();
  if (!trimmed) return r;
  return { ...r, title: trimmed, updatedAt: now };
}

export function setSubtitle(r: ResearchReport, subtitle: string, now: string): ResearchReport {
  return { ...r, subtitle: subtitle.trim(), updatedAt: now };
}

export function setReportStatus(r: ResearchReport, status: ReportStatus, now: string): ResearchReport {
  if (r.status === status) return r;
  return { ...r, status, updatedAt: now };
}

export function archiveReport(r: ResearchReport, now: string): ResearchReport {
  return setReportStatus(r, "ARCHIVED", now);
}

// ── Sections ─────────────────────────────────────────────────────────

export type ReportSectionKind =
  | "executiveSummary"
  | "scopeEntities"
  | "professionalBackground"
  | "careerHistory"
  | "majorEvents"
  | "controversies"
  | "claims"
  | "news"
  | "sentimentHistory"
  | "critiscoreHistory"
  | "attentionHistory"
  | "evidenceSources"
  | "dataCoverage"
  | "methodology"
  | "researchNotes"
  | "conclusion";

export const SECTION_LABEL: Record<ReportSectionKind, string> = {
  executiveSummary: "Executive Summary",
  scopeEntities: "Scope & Entities",
  professionalBackground: "Professional Background",
  careerHistory: "Career & Organization History",
  majorEvents: "Major Events",
  controversies: "Controversies",
  claims: "Claims & Verification",
  news: "News & Public Coverage",
  sentimentHistory: "Sentiment History",
  critiscoreHistory: "CritiScore History",
  attentionHistory: "Attention History",
  evidenceSources: "Evidence & Sources",
  dataCoverage: "Data Coverage & Limitations",
  methodology: "Methodology",
  researchNotes: "Research Notes",
  conclusion: "Conclusion / Findings",
};

/** The default reading order — a report only ever reorders/hides these,
 * never invents a new kind. */
export const DEFAULT_SECTION_ORDER: ReportSectionKind[] = [
  "executiveSummary",
  "scopeEntities",
  "professionalBackground",
  "careerHistory",
  "majorEvents",
  "controversies",
  "claims",
  "news",
  "sentimentHistory",
  "critiscoreHistory",
  "attentionHistory",
  "evidenceSources",
  "dataCoverage",
  "methodology",
  "researchNotes",
  "conclusion",
];

/**
 * Distinguishes what kind of statement a block of report text is —
 * spec section 18. A report is never allowed to present a user note as
 * a verified fact, so the block's own `kind` is the mechanism that
 * enforces that at render time, not a styling convention a component
 * could get wrong.
 */
export type ContentBlockKind = "fact" | "analysis" | "userNote" | "limitation";

export interface ContentBlock {
  blockId: string;
  kind: ContentBlockKind;
  text: string;
  /** Citation numbers (see `Citation.number`) backing this statement.
   * Empty for a limitation/user-note block, which cites nothing. */
  citationIds: string[];
}

export interface ReportSection {
  sectionId: string;
  kind: ReportSectionKind;
  title: string;
  visible: boolean;
  order: number;
  blocks: ContentBlock[];
}

function fact(blockId: string, text: string, citationIds: string[] = []): ContentBlock {
  return { blockId, kind: "fact", text, citationIds };
}
function limitation(blockId: string, text: string): ContentBlock {
  return { blockId, kind: "limitation", text, citationIds: [] };
}
function userNote(blockId: string, text: string): ContentBlock {
  return { blockId, kind: "userNote", text, citationIds: [] };
}

function section(kind: ReportSectionKind, order: number, blocks: ContentBlock[]): ReportSection | null {
  if (blocks.length === 0) return null; // never an empty section
  return { sectionId: kind, kind, title: SECTION_LABEL[kind], visible: true, order, blocks };
}

// ── Citations ────────────────────────────────────────────────────────

export interface Citation {
  citationId: string;
  number: number;
  title: string;
  publisher: string | null;
  date: string | null;
  url: string | null;
  relatedEntityId: string | null;
  relatedReferenceId: string | null;
}

function citationKey(c: Pick<Citation, "url" | "title" | "date">): string {
  return c.url ? `url:${c.url}` : `td:${c.title}|${c.date ?? ""}`;
}

/** Builds a deduplicated, numbered citation list from every included
 * EVIDENCE/SOURCE item's own saved metadata — never a source that
 * wasn't actually included. Identical references (same URL, or same
 * title+date with no URL) collapse into one citation. */
export function buildCitations(includedItems: ResearchItem[]): Citation[] {
  const relevant = includedItems.filter((i) => i.type === "EVIDENCE" || i.type === "SOURCE");
  const byKey = new Map<string, Citation>();
  let n = 0;
  for (const item of relevant) {
    const title = str(item.metadata.sourceName) ?? item.title;
    const date = str(item.metadata.publicationDate);
    const url = str(item.metadata.sourceUrl);
    const key = citationKey({ title, date, url });
    if (byKey.has(key)) continue;
    n += 1;
    byKey.set(key, {
      citationId: `cite-${n}`,
      number: n,
      title,
      publisher: str(item.metadata.sourceType),
      date,
      url,
      relatedEntityId: item.entityId,
      relatedReferenceId: item.referenceId,
    });
  }
  return [...byKey.values()];
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function citationNumbersFor(citations: Citation[], item: ResearchItem): string[] {
  const url = str(item.metadata.sourceUrl);
  const title = str(item.metadata.sourceName) ?? item.title;
  const date = str(item.metadata.publicationDate);
  const key = citationKey({ title, date, url });
  return citations
    .filter((c) => citationKey(c) === key)
    .map((c) => String(c.number));
}

// ── Selection ────────────────────────────────────────────────────────

export interface SelectionSummary {
  includedCount: number;
  excludedCount: number;
  needsReviewCount: number;
  /** True when at least one Needs Review item exists — the report
   * generator still runs (Needs Review items are simply excluded from
   * the report body), but the caller should surface this warning
   * rather than silently proceeding. */
  hasNeedsReview: boolean;
}

export function summarizeSelection(items: ResearchItem[]): SelectionSummary {
  const includedCount = items.filter((i) => i.status === "INCLUDED").length;
  const excludedCount = items.filter((i) => i.status === "EXCLUDED").length;
  const needsReviewCount = items.filter((i) => i.status === "NEEDS_REVIEW").length;
  return { includedCount, excludedCount, needsReviewCount, hasNeedsReview: needsReviewCount > 0 };
}

// ── Per-entity canonical context (optional; sections degrade to a
// disclosed limitation, never a guess, when a piece is missing) ──────

export interface EntityReportContext {
  entityId: string;
  entityName: string;
  profession?: string;
  currentCritiScore?: number | null;
  currentSentimentScore?: number | null;
  coverageReport?: CoverageReport;
  historicalOverview?: HistoricalOverview;
  /** Real Wikipedia-pageviews attention summary, when the profile has
   * one — never derived here, only passed through. */
  attentionSummary?: {
    peakDate: string;
    peakViews: number;
    latestViews: number;
    changePct: number;
  } | null;
}

// ── Generation ───────────────────────────────────────────────────────

export interface GeneratedReport {
  sections: ReportSection[];
  citations: Citation[];
  selection: SelectionSummary;
}

/**
 * Builds every non-empty section from the workspace's INCLUDED items
 * (Needs Review and Excluded items never enter the report body — spec
 * section 5) plus whatever optional per-entity canonical context the
 * caller supplies. A section with nothing to show is omitted entirely,
 * never rendered empty.
 */
export function generateReport(input: {
  workspace: ResearchWorkspace;
  items: ResearchItem[];
  entities: EntityReportContext[];
  now: string;
}): GeneratedReport {
  const { items, entities } = input;
  const included = items.filter((i) => i.status === "INCLUDED");
  const selection = summarizeSelection(items);
  const citations = buildCitations(included);

  const byType = (t: ResearchItem["type"]) => included.filter((i) => i.type === t);

  let blockSeq = 0;
  const nextId = () => `b${++blockSeq}`;

  const sections: (ReportSection | null)[] = [];

  // 1. Executive Summary — composed only from real counts and fields
  // already on the selected items; never an interpretation the data
  // doesn't support.
  {
    const evidenceCount = byType("EVIDENCE").length;
    const claimCount = byType("CLAIM").length;
    const controversyCount = byType("CONTROVERSY").length;
    const entityNames = entities.map((e) => e.entityName);
    const blocks: ContentBlock[] = [];
    if (entityNames.length > 0) {
      blocks.push(
        fact(
          nextId(),
          `This report covers ${entityNames.length === 1 ? entityNames[0] : entityNames.join(", ")}, compiled from ${included.length} selected workspace item${included.length === 1 ? "" : "s"} out of ${items.length} collected.`,
        ),
      );
    }
    if (evidenceCount > 0 || claimCount > 0 || controversyCount > 0) {
      const parts: string[] = [];
      if (controversyCount > 0) parts.push(`${controversyCount} documented controversy record${controversyCount === 1 ? "" : "s"}`);
      if (claimCount > 0) parts.push(`${claimCount} verified claim${claimCount === 1 ? "" : "s"}`);
      if (evidenceCount > 0) parts.push(`${evidenceCount} evidence citation${evidenceCount === 1 ? "" : "s"}`);
      blocks.push(fact(nextId(), `CritiTrack records include ${parts.join(", ")} selected for this report.`));
    }
    if (selection.hasNeedsReview) {
      blocks.push(
        limitation(
          nextId(),
          `${selection.needsReviewCount} workspace item${selection.needsReviewCount === 1 ? "" : "s"} ${selection.needsReviewCount === 1 ? "is" : "are"} marked Needs Review and ${selection.needsReviewCount === 1 ? "was" : "were"} not included in this report.`,
        ),
      );
    }
    blocks.push(
      limitation(
        nextId(),
        "This summary reflects only the sources and records selected for this report, and is not a determination of guilt, wrongdoing, or truth beyond what the cited sources themselves state.",
      ),
    );
    sections.push(section("executiveSummary", 0, blocks));
  }

  // 2. Scope & Entities
  {
    const blocks: ContentBlock[] = entities.map((e) =>
      fact(
        nextId(),
        `${e.entityName}${e.profession ? ` — ${e.profession}` : ""}` +
          (e.currentCritiScore != null ? `. CritiScore: ${Math.round(e.currentCritiScore)}.` : "") +
          (e.currentSentimentScore != null ? ` Sentiment: ${Math.round(e.currentSentimentScore)}.` : ""),
      ),
    );
    sections.push(section("scopeEntities", 1, blocks));
  }

  // 3. Professional Background / 4. Career & Organization History —
  // from included ENTITY items' own saved summary (a profession line
  // captured at save time) plus any explicit career-transition
  // turning points the user saved as HISTORICAL_EVENT/CHANGE_EVENT.
  {
    const entityItems = byType("ENTITY");
    const blocks = entityItems.filter((i) => i.summary).map((i) => fact(nextId(), `${i.title}: ${i.summary}`));
    sections.push(section("professionalBackground", 2, blocks));
  }
  {
    const careerEvents = included.filter(
      (i) => i.type === "CHANGE_EVENT" && String(i.metadata.changeType ?? "").toLowerCase().includes("career"),
    );
    const blocks = careerEvents.map((i) => fact(nextId(), `${i.title}${i.summary ? ` — ${i.summary}` : ""}`));
    sections.push(section("careerHistory", 3, blocks));
  }

  // 5. Major Events — timeline/change events not already represented
  // as a controversy (spec section 12: no duplicate events).
  {
    const controversyRefs = new Set(byType("CONTROVERSY").map((i) => i.referenceId));
    const events = [...byType("TIMELINE_EVENT"), ...byType("CHANGE_EVENT")].filter(
      (i) => !controversyRefs.has(i.referenceId),
    );
    const blocks = events.map((i) =>
      fact(nextId(), `${i.metadata.date ?? i.addedAt.slice(0, 10)} — ${i.title}${i.summary ? `: ${i.summary}` : ""}`),
    );
    sections.push(section("majorEvents", 4, blocks));
  }

  // 6. Controversies
  {
    const blocks = byType("CONTROVERSY").map((i) => {
      const parts = [
        i.metadata.severity != null ? `severity ${i.metadata.severity}` : null,
        str(i.metadata.status),
        i.metadata.year != null ? `${i.metadata.year}` : null,
      ].filter(Boolean);
      return fact(nextId(), `${i.title}${parts.length ? ` (${parts.join(", ")})` : ""}${i.summary ? `. ${i.summary}` : ""}`);
    });
    sections.push(section("controversies", 5, blocks));
  }

  // 7. Claims & Verification — status/confidence exactly as recorded
  // on the workspace item, never recomputed.
  {
    const blocks = byType("CLAIM").flatMap((i) => {
      const out: ContentBlock[] = [
        fact(
          nextId(),
          `Claim: "${i.title}". Verification status: ${str(i.metadata.status) ?? "unknown"}. ` +
            `Confidence: ${str(i.metadata.confidence) ?? "unknown"}.` +
            (i.metadata.evidenceCount != null ? ` Evidence: ${i.metadata.evidenceCount} source(s).` : ""),
        ),
      ];
      if (i.note) out.push(userNote(nextId(), i.note));
      return out;
    });
    sections.push(section("claims", 6, blocks));
  }

  // 8. News & Public Coverage
  {
    const blocks = byType("NEWS_EVENT").map((i) => fact(nextId(), `${i.title}${i.summary ? ` — ${i.summary}` : ""}`, citationNumbersFor(citations, i)));
    sections.push(section("news", 7, blocks));
  }

  // 9-11. Sentiment / CritiScore / Attention history — only when the
  // caller actually supplied a historical overview for that entity;
  // never fabricated when history is sparse or unavailable.
  {
    const blocks: ContentBlock[] = [];
    for (const e of entities) {
      const h = e.historicalOverview;
      if (!h || !h.hasHistory) continue;
      blocks.push(fact(nextId(), `${e.entityName}: sentiment tracked from ${h.firstSnapshotDate} to ${h.latestSnapshotDate} (${h.snapshotCount} measured snapshots).`));
      for (const tp of h.turningPoints.filter((t) => t.kind === "sentiment")) {
        blocks.push(fact(nextId(), `${tp.date} — ${tp.title}`));
      }
    }
    sections.push(section("sentimentHistory", 8, blocks));
  }
  {
    const blocks: ContentBlock[] = [];
    for (const e of entities) {
      const h = e.historicalOverview;
      if (!h) continue;
      const scoreCov = h.coverage.find((c) => c.key === "critiScore");
      if (scoreCov && scoreCov.level !== "unavailable") {
        blocks.push(fact(nextId(), `${e.entityName}: ${scoreCov.reasons.join("; ")}.`));
      }
      for (const tp of h.turningPoints.filter((t) => t.kind === "score")) {
        blocks.push(fact(nextId(), `${tp.date} — ${tp.title}: ${tp.summary}`));
      }
    }
    sections.push(section("critiscoreHistory", 9, blocks));
  }
  {
    const blocks: ContentBlock[] = [];
    for (const e of entities) {
      const a = e.attentionSummary;
      if (!a) continue;
      blocks.push(
        fact(
          nextId(),
          `${e.entityName}: peak attention on ${a.peakDate} (${a.peakViews.toLocaleString()} views); ` +
            `latest ${a.latestViews.toLocaleString()} views (${a.changePct >= 0 ? "+" : ""}${Math.round(a.changePct)}%).`,
        ),
      );
    }
    sections.push(section("attentionHistory", 10, blocks));
  }

  // 12. Evidence & Sources — the numbered citation list itself.
  {
    const blocks = citations.map((c) => fact(nextId(), `[${c.number}] ${c.title}${c.date ? ` — ${c.date}` : ""}${c.url ? ` (${c.url})` : ""}`));
    sections.push(section("evidenceSources", 11, blocks));
  }

  // 13. Data Coverage & Limitations — always included when any entity
  // has a coverage report; never hides a gap.
  {
    const blocks: ContentBlock[] = [];
    for (const e of entities) {
      if (!e.coverageReport) continue;
      for (const d of e.coverageReport.dimensions) {
        if (d.level === "unavailable") {
          blocks.push(limitation(nextId(), `${e.entityName} — ${d.label}: ${d.reasons.join("; ") || "unavailable"}.`));
        }
      }
    }
    sections.push(section("dataCoverage", 12, blocks));
  }

  // 14. Methodology — static, versioned, never re-derived. Explains
  // only the systems this report's own content actually drew on
  // (spec section 10: "explain relevant systems"), plus entity
  // resolution and evidence, which every report depends on regardless
  // of which sections it includes.
  {
    const relevantMethodologySystems = new Set(["entityResolution", "evidence"]);
    if (byType("CLAIM").length > 0) relevantMethodologySystems.add("claims");
    if (byType("CONTROVERSY").length > 0) relevantMethodologySystems.add("critiscore");
    if (entities.some((e) => e.currentSentimentScore != null || e.historicalOverview?.hasHistory)) {
      relevantMethodologySystems.add("sentiment");
    }
    if (entities.some((e) => e.coverageReport)) relevantMethodologySystems.add("coverage");
    if (entities.some((e) => e.historicalOverview)) relevantMethodologySystems.add("historical");

    const relevantSections: MethodologySection[] = METHODOLOGY_SECTIONS.filter(
      (s) => s.system != null && relevantMethodologySystems.has(s.system),
    );
    const blocks = relevantSections.map((s) => fact(nextId(), `${s.title}: ${s.paragraphs[0]}`));
    sections.push(section("methodology", 13, blocks));
  }

  // 15. Research Notes — freestanding NOTE items and any note attached
  // to another included item, always labeled as the user's own words.
  {
    const noteItems = byType("NOTE");
    const annotated = included.filter((i) => i.type !== "NOTE" && i.note);
    const blocks = [
      ...noteItems.map((i) => userNote(nextId(), i.note)),
      ...annotated.map((i) => userNote(nextId(), `${i.title}: ${i.note}`)),
    ];
    sections.push(section("researchNotes", 14, blocks));
  }

  // 16. Conclusion — deliberately restrained: a plain restatement of
  // scope, never a verdict.
  {
    const blocks = [
      fact(
        nextId(),
        `This report presents the research selected as of ${input.now.slice(0, 10)}. It is a structured presentation of existing CritiTrack records, not an independent finding, and should be read alongside the cited sources.`,
      ),
    ];
    sections.push(section("conclusion", 15, blocks));
  }

  const finalSections = sections.filter((s): s is ReportSection => s !== null);
  return { sections: finalSections, citations, selection };
}
