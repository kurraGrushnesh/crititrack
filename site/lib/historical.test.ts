import { describe, expect, test } from "vitest";
import {
  buildHistoricalSnapshots,
  buildHistoricalCoverage,
  buildHistoricalOverview,
  supportedTimeRanges,
  filterSnapshotsByRange,
  majorTurningPoints,
  comparePeriods,
  filterTurningPoints,
} from "./historical";
import type { Controversy } from "./controversy";
import type { CareerEntry } from "./career";
import type { Claim } from "./claims";
import type { ChangeEvent } from "./changes";
import type { TrendPoint } from "./api";

function careerEntry(overrides: Partial<CareerEntry> = {}): CareerEntry {
  return {
    start: 2020,
    end: null,
    role: "Analyst",
    organization: "Firm A",
    location: null,
    industry: null,
    current: true,
    source: { name: "Wikidata", url: "https://www.wikidata.org/wiki/Q1" },
    ...overrides,
  };
}

function controversy(overrides: Partial<Controversy> = {}): Controversy {
  return {
    title: "Fraud allegations",
    summary: "The executive was accused of misrepresenting finances.",
    category: "Financial",
    severity: 4,
    status: "ongoing",
    year: 2021,
    sources: ["https://reuters.com/1"],
    ...overrides,
  };
}

function trend(points: Array<[string, number, number]>): TrendPoint[] {
  return points.map(([date, score, mentions]) => ({ date, score, mentions }));
}

function baseProfile(overrides: {
  trend?: TrendPoint[];
  controversies?: Controversy[];
  career?: CareerEntry[];
} = {}) {
  return {
    slug: "jane-doe",
    trend: overrides.trend ?? [],
    controversies: overrides.controversies ?? [],
    career: { timeline: overrides.career ?? [], organizations: [], insights: { start: null, current: null, transitions: [], leadershipRoles: [], founder: false, progression: [] }, available: (overrides.career ?? []).length > 0 },
  };
}

describe("buildHistoricalSnapshots", () => {
  test("returns nothing with fewer than two measured points — a single point has no shape", () => {
    const profile = baseProfile({ trend: trend([["2024-01-01", 50, 10]]) });
    expect(buildHistoricalSnapshots(profile, [])).toEqual([]);
  });

  test("builds one snapshot per measured sentiment date, sorted ascending", () => {
    const profile = baseProfile({
      trend: trend([
        ["2024-02-01", 60, 20],
        ["2024-01-01", 50, 10],
      ]),
    });
    const snaps = buildHistoricalSnapshots(profile, []);
    expect(snaps.map((s) => s.capturedAt)).toEqual(["2024-01-01", "2024-02-01"]);
    expect(snaps[0].sentimentScore).toBe(50);
  });

  test("overlays career state as of each snapshot's year — no role before its start date", () => {
    const profile = baseProfile({
      trend: trend([
        ["2019-06-01", 50, 5],
        ["2021-06-01", 55, 8],
      ]),
      career: [careerEntry({ start: 2020, role: "Analyst", organization: "Firm A" })],
    });
    const snaps = buildHistoricalSnapshots(profile, []);
    expect(snaps[0].currentRole).toBeNull();
    expect(snaps[1].currentRole).toBe("Analyst, Firm A");
  });

  test("counts only controversies dated on or before the snapshot's year", () => {
    const profile = baseProfile({
      trend: trend([
        ["2020-06-01", 50, 5],
        ["2022-06-01", 40, 5],
      ]),
      controversies: [controversy({ year: 2021 })],
    });
    const snaps = buildHistoricalSnapshots(profile, []);
    expect(snaps[0].controversyCount).toBe(0);
    expect(snaps[1].controversyCount).toBe(1);
    expect(snaps[0].critiScore).toBeNull();
    expect(snaps[1].critiScore).not.toBeNull();
  });

  test("counts claims that belong to a controversy in scope, keyed by titleSlug", () => {
    const c = controversy({ title: "Fraud allegations", year: 2021 });
    const claim: Claim = {
      claimId: "c1",
      entityId: null,
      controversyId: "fraud-allegations",
      timelineEventId: null,
      claimText: "It happened",
      claimType: "allegation",
      dateContext: "2021",
      status: "unverified",
      confidence: "low",
      supportingEvidenceIds: [],
      contradictingEvidenceIds: [],
      neutralEvidenceIds: [],
      responseEvidenceIds: [],
      createdAt: null,
      updatedAt: null,
      methodologyVersion: "cvm-1",
    } as unknown as Claim;
    const profile = baseProfile({ trend: trend([["2021-01-01", 40, 1], ["2022-01-01", 40, 1]]), controversies: [c] });
    const snaps = buildHistoricalSnapshots(profile, [claim]);
    expect(snaps[1].claimCount).toBe(1);
  });
});

describe("supportedTimeRanges / filterSnapshotsByRange", () => {
  test("offers no ranges with fewer than two snapshots", () => {
    expect(supportedTimeRanges([])).toEqual([]);
  });

  test("only offers ranges the data span actually supports, plus 'all'", () => {
    const now = Date.parse("2024-03-01T00:00:00Z");
    const profile = baseProfile({
      trend: trend([
        ["2024-02-05", 50, 5],
        ["2024-02-25", 55, 5],
      ]),
    });
    const snaps = buildHistoricalSnapshots(profile, []);
    const ranges = supportedTimeRanges(snaps, now);
    expect(ranges).toContain("30d");
    expect(ranges).toContain("all");
    expect(ranges).not.toContain("5y");
  });

  test("filterSnapshotsByRange('all') returns everything unfiltered", () => {
    const profile = baseProfile({ trend: trend([["2010-01-01", 50, 1], ["2024-01-01", 60, 1]]) });
    const snaps = buildHistoricalSnapshots(profile, []);
    expect(filterSnapshotsByRange(snaps, "all").length).toBe(2);
  });
});

describe("buildHistoricalCoverage", () => {
  test("marks every dimension unavailable, never zero, when there is no data", () => {
    const cov = buildHistoricalCoverage([], [], [], [], []);
    for (const d of cov) {
      expect(d.level).toBe("unavailable");
      expect(d.status).toBe("unavailable");
    }
  });
});

describe("majorTurningPoints", () => {
  test("flags only large year-over-year CritiScore reconstruction moves", () => {
    const points = majorTurningPoints(
      [
        { year: 2020, score: 10 },
        { year: 2021, score: 12 },
        { year: 2022, score: 60 },
      ],
      [],
      [],
    );
    expect(points.some((p) => p.kind === "score" && p.date === "2022")).toBe(true);
    expect(points.some((p) => p.date === "2021")).toBe(false);
  });

  test("includes MAJOR/SIGNIFICANT change events but not MINOR/INFO ones", () => {
    const change = (severity: ChangeEvent["severity"], id: string): ChangeEvent => ({
      changeId: id,
      entityId: "jane-doe",
      changeType: "CAREER_CHANGE",
      severity,
      title: `Change ${id}`,
      summary: "",
      previousValue: null,
      currentValue: null,
      detectedAt: "2024-01-01T00:00:00Z",
      effectiveDate: null,
      evidenceIds: [],
      relatedClaimIds: [],
      methodologyVersion: "1.0",
      confidence: "HIGH",
      sourceCoverage: null,
    });
    const points = majorTurningPoints([], [], [change("MAJOR", "a"), change("MINOR", "b")]);
    expect(points.some((p) => p.id === "a")).toBe(true);
    expect(points.some((p) => p.id === "b")).toBe(false);
  });
});

describe("filterTurningPoints", () => {
  test("'all' returns everything; a kind filters to only that kind", () => {
    const points = [
      { id: "1", kind: "score" as const, date: "2020", title: "t", summary: "s" },
      { id: "2", kind: "career" as const, date: "2021", title: "t", summary: "s" },
    ];
    expect(filterTurningPoints(points, "all").length).toBe(2);
    expect(filterTurningPoints(points, "career")).toEqual([points[1]]);
  });
});

describe("comparePeriods", () => {
  test("a period with no snapshots reports nulls, not fabricated zeros", () => {
    const cmp = comparePeriods([], "30d", "1y");
    expect(cmp.startScoreA).toBeNull();
    expect(cmp.endScoreA).toBeNull();
    expect(cmp.controversyCountA).toBe(0);
  });
});

describe("buildHistoricalOverview", () => {
  test("hasHistory is false for a figure with no snapshots, no score history, no turning points", () => {
    const overview = buildHistoricalOverview({ profile: baseProfile(), claims: [], changeEvents: [] });
    expect(overview.hasHistory).toBe(false);
    expect(overview.firstSnapshotDate).toBeNull();
  });

  test("hasHistory is true once real dated controversies produce a score history", () => {
    const profile = baseProfile({
      controversies: [controversy({ year: 2019 }), controversy({ title: "Second", year: 2022 })],
    });
    const overview = buildHistoricalOverview({ profile, claims: [], changeEvents: [] });
    expect(overview.hasHistory).toBe(true);
  });
});
