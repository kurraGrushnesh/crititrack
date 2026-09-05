import { describe, expect, test } from "vitest";
import {
  createReport,
  renameReport,
  setSubtitle,
  archiveReport,
  buildCitations,
  summarizeSelection,
  generateReport,
  type EntityReportContext,
} from "./report";
import { buildItem, type ResearchItem, type ResearchWorkspace } from "./research";

const NOW = "2026-09-05T00:00:00.000Z";
const LATER = "2026-09-06T00:00:00.000Z";

function workspace(): ResearchWorkspace {
  return {
    workspaceId: "w1",
    userId: "u1",
    title: "Research — Jane Doe",
    description: "",
    createdAt: NOW,
    updatedAt: NOW,
    entityIds: ["Q1"],
    status: "ACTIVE",
    tags: [],
    lastOpenedAt: NOW,
  };
}

function item(overrides: Partial<ResearchItem> & { type: ResearchItem["type"] }): ResearchItem {
  return buildItem({
    itemId: overrides.itemId ?? `i-${Math.random()}`,
    workspaceId: "w1",
    type: overrides.type,
    title: overrides.title ?? "Item",
    referenceId: overrides.referenceId,
    note: overrides.note,
    metadata: overrides.metadata,
    now: NOW,
  });
}

describe("createReport / mutators", () => {
  test("defaults to DRAFT status, STANDARD template, version 1", () => {
    const r = createReport({ reportId: "r1", workspaceId: "w1", userId: "u1", entityIds: ["Q1"], now: NOW });
    expect(r.status).toBe("DRAFT");
    expect(r.template).toBe("STANDARD");
    expect(r.version).toBe(1);
    expect(r.title).toBe("Untitled report");
  });

  test("rename ignores a blank title", () => {
    const r = createReport({ reportId: "r1", workspaceId: "w1", userId: "u1", entityIds: [], now: NOW });
    expect(renameReport(r, "   ", LATER).title).toBe(r.title);
    expect(renameReport(r, "Final report", LATER).title).toBe("Final report");
  });

  test("setSubtitle trims and bumps updatedAt", () => {
    const r = createReport({ reportId: "r1", workspaceId: "w1", userId: "u1", entityIds: [], now: NOW });
    const next = setSubtitle(r, "  A closer look  ", LATER);
    expect(next.subtitle).toBe("A closer look");
    expect(next.updatedAt).toBe(LATER);
  });

  test("archiveReport is idempotent", () => {
    const r = createReport({ reportId: "r1", workspaceId: "w1", userId: "u1", entityIds: [], now: NOW });
    const archived = archiveReport(r, LATER);
    expect(archived.status).toBe("ARCHIVED");
    expect(archiveReport(archived, LATER)).toBe(archived);
  });
});

describe("summarizeSelection", () => {
  test("counts each status and flags needs-review", () => {
    const items = [
      item({ type: "EVIDENCE" }),
      { ...item({ type: "EVIDENCE" }), status: "EXCLUDED" as const },
      { ...item({ type: "CLAIM" }), status: "NEEDS_REVIEW" as const },
    ];
    const summary = summarizeSelection(items);
    expect(summary.excludedCount).toBe(1);
    expect(summary.needsReviewCount).toBe(1);
    expect(summary.hasNeedsReview).toBe(true);
  });

  test("no needs-review items reports hasNeedsReview false", () => {
    const items = [{ ...item({ type: "EVIDENCE" }), status: "INCLUDED" as const }];
    expect(summarizeSelection(items).hasNeedsReview).toBe(false);
  });
});

describe("buildCitations", () => {
  test("dedupes identical source URLs into one numbered citation", () => {
    const items = [
      item({ type: "EVIDENCE", title: "Story A", metadata: { sourceName: "Reuters", sourceUrl: "https://reuters.com/1", publicationDate: "2026-01-01" } }),
      item({ type: "EVIDENCE", title: "Story A (again)", metadata: { sourceName: "Reuters", sourceUrl: "https://reuters.com/1", publicationDate: "2026-01-01" } }),
    ];
    const citations = buildCitations(items);
    expect(citations).toHaveLength(1);
    expect(citations[0].number).toBe(1);
  });

  test("different sources get distinct, sequential citation numbers", () => {
    const items = [
      item({ type: "EVIDENCE", metadata: { sourceName: "Reuters", sourceUrl: "https://reuters.com/1" } }),
      item({ type: "SOURCE", title: "AP report", metadata: { sourceName: "AP", sourceUrl: "https://apnews.com/2" } }),
    ];
    const citations = buildCitations(items);
    expect(citations.map((c) => c.number)).toEqual([1, 2]);
  });

  test("never cites an item that was not included in the passed list", () => {
    // buildCitations only ever sees what the caller already filtered to
    // INCLUDED — this test documents that contract at the call site.
    const included = [item({ type: "EVIDENCE", metadata: { sourceName: "Reuters", sourceUrl: "https://reuters.com/1" } })];
    const citations = buildCitations(included);
    expect(citations).toHaveLength(1);
  });

  test("a claim or note item never produces a citation", () => {
    const items = [item({ type: "CLAIM" }), item({ type: "NOTE" })];
    expect(buildCitations(items)).toEqual([]);
  });
});

describe("generateReport", () => {
  test("excludes NEEDS_REVIEW and EXCLUDED items from every section", () => {
    const included = { ...item({ type: "CONTROVERSY", title: "Included controversy" }), status: "INCLUDED" as const };
    const needsReview = { ...item({ type: "CONTROVERSY", title: "Unreviewed controversy" }), status: "NEEDS_REVIEW" as const };
    const excluded = { ...item({ type: "CONTROVERSY", title: "Excluded controversy" }), status: "EXCLUDED" as const };
    const result = generateReport({ workspace: workspace(), items: [included, needsReview, excluded], entities: [], now: NOW });
    const controversySection = result.sections.find((s) => s.kind === "controversies");
    const text = controversySection?.blocks.map((b) => b.text).join(" ") ?? "";
    expect(text).toContain("Included controversy");
    expect(text).not.toContain("Unreviewed controversy");
    expect(text).not.toContain("Excluded controversy");
  });

  test("surfaces a Needs Review warning in the executive summary without blocking generation", () => {
    const items = [{ ...item({ type: "CLAIM" }), status: "NEEDS_REVIEW" as const }];
    const result = generateReport({ workspace: workspace(), items, entities: [], now: NOW });
    expect(result.selection.hasNeedsReview).toBe(true);
    const summary = result.sections.find((s) => s.kind === "executiveSummary");
    expect(summary?.blocks.some((b) => b.kind === "limitation" && b.text.includes("Needs Review"))).toBe(true);
  });

  test("never produces an empty section", () => {
    const result = generateReport({ workspace: workspace(), items: [], entities: [], now: NOW });
    for (const s of result.sections) {
      expect(s.blocks.length).toBeGreaterThan(0);
    }
    // With nothing selected and no entities, only the always-present
    // transparency sections (methodology) and the closing framing
    // (executive summary, conclusion) have anything to say.
    expect(result.sections.every((s) => ["conclusion", "executiveSummary", "methodology"].includes(s.kind))).toBe(true);
  });

  test("a claim block shows the status/confidence exactly as saved on the item, never recomputed", () => {
    const claim = item({
      type: "CLAIM",
      title: "Denial statement",
      metadata: { status: "conflicting", confidence: "medium", evidenceCount: 3 },
    });
    const included = { ...claim, status: "INCLUDED" as const };
    const result = generateReport({ workspace: workspace(), items: [included], entities: [], now: NOW });
    const claimsSection = result.sections.find((s) => s.kind === "claims");
    const text = claimsSection?.blocks[0]?.text ?? "";
    expect(text).toContain("conflicting");
    expect(text).toContain("medium");
    expect(text).toContain("3 source(s)");
  });

  test("a user's note on a claim is labeled as a userNote block, never a fact", () => {
    const claim = { ...item({ type: "CLAIM", title: "X", note: "I think this needs a second source." }), status: "INCLUDED" as const };
    const result = generateReport({ workspace: workspace(), items: [claim], entities: [], now: NOW });
    const claimsSection = result.sections.find((s) => s.kind === "claims");
    const noteBlock = claimsSection?.blocks.find((b) => b.kind === "userNote");
    expect(noteBlock?.text).toContain("second source");
  });

  test("freestanding notes always render as userNote blocks", () => {
    const note = { ...item({ type: "NOTE", title: "Research note" }), note: "Follow up next week.", status: "INCLUDED" as const };
    const result = generateReport({ workspace: workspace(), items: [note], entities: [], now: NOW });
    const notesSection = result.sections.find((s) => s.kind === "researchNotes");
    expect(notesSection?.blocks[0].kind).toBe("userNote");
  });

  test("a controversy already present is not duplicated as a major event", () => {
    const controversy = { ...item({ type: "CONTROVERSY", title: "Fraud allegations", referenceId: "fraud-allegations" }), status: "INCLUDED" as const };
    const changeEvent = {
      ...item({ type: "CHANGE_EVENT", title: "Fraud allegations", referenceId: "fraud-allegations", metadata: { changeType: "CONTROVERSY_CHANGE" } }),
      status: "INCLUDED" as const,
    };
    const result = generateReport({ workspace: workspace(), items: [controversy, changeEvent], entities: [], now: NOW });
    const majorEvents = result.sections.find((s) => s.kind === "majorEvents");
    expect(majorEvents).toBeUndefined(); // the change event was filtered as a duplicate of the controversy
  });

  test("data coverage section reports only real gaps, never invents complete coverage", () => {
    const entities: EntityReportContext[] = [
      {
        entityId: "Q1",
        entityName: "Jane Doe",
        coverageReport: {
          coverageVersion: "coverage-1",
          dimensions: [
            { key: "attention", label: "Attention", level: "unavailable", status: "unavailable", reasons: ["No pageview data retrieved."] },
            { key: "news", label: "News", level: "high", status: "available", reasons: ["12 articles"] },
          ],
        },
      },
    ];
    const result = generateReport({ workspace: workspace(), items: [], entities, now: NOW });
    const coverage = result.sections.find((s) => s.kind === "dataCoverage");
    expect(coverage?.blocks[0].text).toContain("Attention");
    expect(coverage?.blocks[0].kind).toBe("limitation");
    expect(coverage?.blocks.some((b) => b.text.includes("News"))).toBe(false);
  });

  test("sparse or absent historical data produces no fabricated history section", () => {
    const entities: EntityReportContext[] = [
      {
        entityId: "Q1",
        entityName: "Jane Doe",
        historicalOverview: {
          entityId: "Q1",
          firstSnapshotDate: null,
          latestSnapshotDate: null,
          snapshotCount: 0,
          supportedRanges: [],
          coverage: [],
          turningPoints: [],
          hasHistory: false,
        },
      },
    ];
    const result = generateReport({ workspace: workspace(), items: [], entities, now: NOW });
    expect(result.sections.some((s) => s.kind === "sentimentHistory")).toBe(false);
    expect(result.sections.some((s) => s.kind === "critiscoreHistory")).toBe(false);
  });
});
