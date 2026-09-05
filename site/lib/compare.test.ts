import { describe, expect, test } from "vitest";
import {
  createComparison,
  renameComparison,
  updateFilters,
  updateTimeRange,
  buildComparison,
  keyDifferences,
  turningPointsFor,
  defaultComparisonFilters,
  type EntityComparisonContext,
} from "./compare";
import type { Controversy } from "./controversy";
import type { Claim } from "./claims";

const NOW = "2026-09-05T00:00:00.000Z";
const LATER = "2026-09-06T00:00:00.000Z";
const NOW_MS = Date.parse(NOW);

function controversy(overrides: Partial<Controversy> = {}): Controversy {
  return {
    title: "Episode",
    summary: "Summary.",
    category: "Financial",
    severity: 3,
    status: "ongoing",
    year: 2024,
    sources: ["https://reuters.com/1"],
    ...overrides,
  };
}

function claim(overrides: Partial<Claim> = {}): Claim {
  return {
    claimId: "c1",
    entityId: null,
    controversyId: "episode",
    timelineEventId: null,
    claimText: "It happened",
    claimType: "allegation",
    dateContext: "2024",
    status: "reported_uncorroborated",
    confidence: "low",
    supportingEvidenceIds: [],
    contradictingEvidenceIds: [],
    neutralEvidenceIds: [],
    responseEvidenceIds: [],
    createdAt: null,
    updatedAt: null,
    methodologyVersion: "cvm-1",
    statusReason: "",
    ...overrides,
  };
}

function entity(overrides: Partial<EntityComparisonContext> & { entityId: string; entityName: string }): EntityComparisonContext {
  return {
    profession: null,
    country: null,
    currentRole: null,
    industries: [],
    watchStatus: false,
    critiScore: null,
    critiScoreBand: null,
    critiScoreHistory: [],
    sentimentScore: null,
    sentimentBand: null,
    sentimentTrendDirection: null,
    sentimentSnapshots: [],
    attentionSummary: null,
    career: { timeline: [], organizations: [], insights: { start: null, current: null, transitions: [], leadershipRoles: [], founder: false, progression: [] }, available: false },
    controversies: [],
    claims: [],
    meaningfulNewsCount: 0,
    coverageReport: null,
    historicalOverview: null,
    ...overrides,
  };
}

describe("createComparison / mutators", () => {
  test("defaults the title from entity names", () => {
    const c = createComparison({ comparisonId: "cp1", userId: "u1", entityIds: ["Q1", "Q2"], entityNames: ["Jane Doe", "John Roe"], now: NOW });
    expect(c.title).toBe("Jane Doe vs John Roe");
    expect(c.timeRange).toBe("1y");
    expect(c.filters).toEqual(defaultComparisonFilters());
  });

  test("rename ignores a blank title", () => {
    const c = createComparison({ comparisonId: "cp1", userId: "u1", entityIds: ["Q1", "Q2"], now: NOW });
    expect(renameComparison(c, "   ", LATER).title).toBe(c.title);
    expect(renameComparison(c, "Final", LATER).title).toBe("Final");
  });

  test("updateFilters merges rather than replaces", () => {
    const c = createComparison({ comparisonId: "cp1", userId: "u1", entityIds: ["Q1", "Q2"], now: NOW });
    const next = updateFilters(c, { topic: "CONTROVERSY" }, LATER);
    expect(next.filters.topic).toBe("CONTROVERSY");
    expect(next.filters.dataMode).toBe("ALL");
  });

  test("updateTimeRange bumps updatedAt", () => {
    const c = createComparison({ comparisonId: "cp1", userId: "u1", entityIds: ["Q1", "Q2"], now: NOW });
    const next = updateTimeRange(c, "5y", LATER);
    expect(next.timeRange).toBe("5y");
    expect(next.updatedAt).toBe(LATER);
  });
});

describe("buildComparison — neutral language", () => {
  test("never emits judgmental language, only count/value differences", () => {
    const a = entity({ entityId: "Q1", entityName: "Jane Doe", critiScore: 80, controversies: [controversy(), controversy({ title: "Two" })] });
    const b = entity({ entityId: "Q2", entityName: "John Roe", critiScore: 20, controversies: [controversy()] });
    const sections = buildComparison({ a, b, filters: defaultComparisonFilters(), timeRange: "all", now: NOW_MS });
    const allText = sections.flatMap((s) => s.rows).map((r) => r.note).join(" ").toLowerCase();
    for (const banned of ["better", "worse", "more trustworthy", "more guilty", "more corrupt", "is guilty", "caused"]) {
      expect(allText).not.toContain(banned);
    }
  });

  test("equal values produce a null note, not a fabricated difference", () => {
    const a = entity({ entityId: "Q1", entityName: "A", critiScore: 50 });
    const b = entity({ entityId: "Q2", entityName: "B", critiScore: 50 });
    const sections = buildComparison({ a, b, filters: defaultComparisonFilters(), timeRange: "all", now: NOW_MS });
    const critiscoreRow = sections.find((s) => s.topic === "CRITISCORE")?.rows.find((r) => r.rowId === "critiscore-current");
    expect(critiscoreRow?.note).toBeNull();
  });

  test("missing data on both sides never fabricates a value — reports Unavailable", () => {
    const a = entity({ entityId: "Q1", entityName: "A" });
    const b = entity({ entityId: "Q2", entityName: "B" });
    const sections = buildComparison({ a, b, filters: defaultComparisonFilters(), timeRange: "all", now: NOW_MS });
    const critiscoreRow = sections.find((s) => s.topic === "CRITISCORE")?.rows.find((r) => r.rowId === "critiscore-current");
    expect(critiscoreRow?.valueA).toBe("Unavailable");
    expect(critiscoreRow?.valueB).toBe("Unavailable");
  });
});

describe("buildComparison — controversy comparison", () => {
  test("counts controversies within the selected time range only", () => {
    const a = entity({
      entityId: "Q1",
      entityName: "A",
      controversies: [controversy({ year: 2020 }), controversy({ title: "Recent", year: 2026 })],
    });
    const b = entity({ entityId: "Q2", entityName: "B", controversies: [controversy({ year: 2026 })] });
    const sections = buildComparison({ a, b, filters: defaultComparisonFilters(), timeRange: "1y", now: NOW_MS });
    const countRow = sections.find((s) => s.topic === "CONTROVERSY")?.rows.find((r) => r.rowId === "controversy-count");
    expect(countRow?.valueA).toBe("1"); // the 2020 one is outside the 1-year window
    expect(countRow?.valueB).toBe("1");
  });

  test("phrases the controversy difference as a dataset fact, not a character judgment", () => {
    const a = entity({ entityId: "Q1", entityName: "Jane Doe", controversies: [controversy(), controversy({ title: "Two" })] });
    const b = entity({ entityId: "Q2", entityName: "John Roe", controversies: [] });
    const sections = buildComparison({ a, b, filters: defaultComparisonFilters(), timeRange: "all", now: NOW_MS });
    const countRow = sections.find((s) => s.topic === "CONTROVERSY")?.rows.find((r) => r.rowId === "controversy-count");
    expect(countRow?.note).toContain("documented controversy record(s) in the available CritiTrack dataset");
    expect(countRow?.note).not.toContain("more controversial");
  });
});

describe("buildComparison — claims", () => {
  test("uses neutral 'documented claims' language, never a misconduct count", () => {
    const a = entity({ entityId: "Q1", entityName: "A", claims: [claim(), claim({ claimId: "c2" })] });
    const b = entity({ entityId: "Q2", entityName: "B", claims: [claim({ claimId: "c3" })] });
    const sections = buildComparison({ a, b, filters: defaultComparisonFilters(), timeRange: "all", now: NOW_MS });
    const claimRow = sections.find((s) => s.topic === "CLAIMS")?.rows.find((r) => r.rowId === "claim-count");
    expect(claimRow?.metric).toBe("Documented claims in selected period");
    expect(claimRow?.note).not.toContain("bad behavior");
  });

  test("corroborated claims are counted from real status values only", () => {
    const a = entity({
      entityId: "Q1",
      entityName: "A",
      claims: [claim({ status: "supported" }), claim({ claimId: "c2", status: "reported_uncorroborated" })],
    });
    const b = entity({ entityId: "Q2", entityName: "B", claims: [] });
    const sections = buildComparison({ a, b, filters: defaultComparisonFilters(), timeRange: "all", now: NOW_MS });
    const corroboratedRow = sections.find((s) => s.topic === "CLAIMS")?.rows.find((r) => r.rowId === "claim-corroborated");
    expect(corroboratedRow?.valueA).toBe("1");
  });
});

describe("buildComparison — topic filter", () => {
  test("filtering to one topic returns only that topic's section", () => {
    const a = entity({ entityId: "Q1", entityName: "A", critiScore: 40, claims: [claim()] });
    const b = entity({ entityId: "Q2", entityName: "B", critiScore: 60, claims: [] });
    const sections = buildComparison({ a, b, filters: { topic: "CLAIMS", dataMode: "ALL" }, timeRange: "all", now: NOW_MS });
    expect(sections.every((s) => s.topic === "CLAIMS")).toBe(true);
    expect(sections.some((s) => s.topic === "CRITISCORE")).toBe(false);
  });
});

describe("buildComparison — evidence-backed mode", () => {
  test("excludes rows with no real evidence backing", () => {
    const a = entity({ entityId: "Q1", entityName: "A", currentRole: "CEO" });
    const b = entity({ entityId: "Q2", entityName: "B", currentRole: "Founder" });
    const sections = buildComparison({ a, b, filters: { topic: "ALL", dataMode: "EVIDENCE_BACKED" }, timeRange: "all", now: NOW_MS });
    // "Current role" has no evidenceBacked flag, so it must not appear.
    const roleRow = sections.flatMap((s) => s.rows).find((r) => r.rowId === "current-role");
    expect(roleRow).toBeUndefined();
  });

  test("keeps controversy rows that are actually sourced", () => {
    const a = entity({ entityId: "Q1", entityName: "A", controversies: [controversy({ sources: ["https://reuters.com/1"] })] });
    const b = entity({ entityId: "Q2", entityName: "B", controversies: [] });
    const sections = buildComparison({ a, b, filters: { topic: "ALL", dataMode: "EVIDENCE_BACKED" }, timeRange: "all", now: NOW_MS });
    const countRow = sections.flatMap((s) => s.rows).find((r) => r.rowId === "controversy-count");
    expect(countRow).toBeDefined();
  });
});

describe("buildComparison — data coverage", () => {
  test("only shows a coverage row when the two entities actually differ", () => {
    const a = entity({
      entityId: "Q1",
      entityName: "A",
      coverageReport: { coverageVersion: "coverage-1", dimensions: [{ key: "news", label: "News", level: "high", status: "available", reasons: [] }] },
    });
    const b = entity({
      entityId: "Q2",
      entityName: "B",
      coverageReport: { coverageVersion: "coverage-1", dimensions: [{ key: "news", label: "News", level: "low", status: "limited", reasons: [] }] },
    });
    const sections = buildComparison({ a, b, filters: defaultComparisonFilters(), timeRange: "all", now: NOW_MS });
    const coverageRow = sections.flatMap((s) => s.rows).find((r) => r.rowId === "coverage-news");
    expect(coverageRow).toBeDefined();
    expect(coverageRow?.note).toContain("limited by unequal available data");
  });

  test("identical coverage levels produce no row at all", () => {
    const report = { coverageVersion: "coverage-1", dimensions: [{ key: "news" as const, label: "News", level: "high" as const, status: "available" as const, reasons: [] }] };
    const a = entity({ entityId: "Q1", entityName: "A", coverageReport: report });
    const b = entity({ entityId: "Q2", entityName: "B", coverageReport: report });
    const sections = buildComparison({ a, b, filters: defaultComparisonFilters(), timeRange: "all", now: NOW_MS });
    const coverageRow = sections.flatMap((s) => s.rows).find((r) => r.rowId === "coverage-news");
    expect(coverageRow).toBeUndefined();
  });
});

describe("keyDifferences", () => {
  test("collects only real notes, capped, in section order", () => {
    const a = entity({ entityId: "Q1", entityName: "A", critiScore: 80, claims: [claim()] });
    const b = entity({ entityId: "Q2", entityName: "B", critiScore: 20, claims: [] });
    const sections = buildComparison({ a, b, filters: defaultComparisonFilters(), timeRange: "all", now: NOW_MS });
    const diffs = keyDifferences(sections, 2);
    expect(diffs.length).toBeLessThanOrEqual(2);
    expect(diffs.every((d) => typeof d === "string")).toBe(true);
  });
});

describe("turningPointsFor", () => {
  test("returns each entity's own turning points, never merged or attributed to the other", () => {
    const a = entity({
      entityId: "Q1",
      entityName: "A",
      historicalOverview: {
        entityId: "Q1",
        firstSnapshotDate: "2024-01-01",
        latestSnapshotDate: "2026-01-01",
        snapshotCount: 5,
        supportedRanges: ["all"],
        coverage: [],
        turningPoints: [{ id: "tp1", kind: "score", date: "2025", title: "Score moved", summary: "" }],
        hasHistory: true,
      },
    });
    const b = entity({ entityId: "Q2", entityName: "B" });
    const [pointsA, pointsB] = turningPointsFor(a, b);
    expect(pointsA.points).toHaveLength(1);
    expect(pointsB.points).toHaveLength(0);
  });
});
