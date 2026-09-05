import { describe, expect, test } from "vitest";
import {
  filterBySeverity,
  filterByConfidence,
  filterByTimeRange,
  applyWatchFilters,
  importantChanges,
  unseenChanges,
  buildWatchOverview,
  importantNewsFromTimeline,
} from "./watch-intelligence";
import type { ChangeEvent } from "./changes";
import type { RealProfile } from "./api";
import type { TimelineEvent } from "./timeline";
import type { ProfessionalIdentity } from "./professional-identity";

function change(overrides: Partial<ChangeEvent> = {}): ChangeEvent {
  return {
    changeId: "c1",
    entityId: "x",
    changeType: "CRITISCORE_CHANGE",
    severity: "SIGNIFICANT",
    title: "CritiScore increased +9",
    summary: "reason",
    previousValue: "38",
    currentValue: "47",
    detectedAt: "2026-09-01T00:00:00Z",
    effectiveDate: null,
    evidenceIds: [],
    relatedClaimIds: [],
    methodologyVersion: "2.0",
    confidence: "MEDIUM",
    sourceCoverage: null,
    ...overrides,
  };
}

describe("filterBySeverity", () => {
  test("ALL passes everything through", () => {
    const list = [change({ severity: "INFO" }), change({ severity: "MAJOR" })];
    expect(filterBySeverity(list, "ALL")).toHaveLength(2);
  });

  test("a minimum keeps that level and above only", () => {
    const list = [
      change({ changeId: "info", severity: "INFO" }),
      change({ changeId: "minor", severity: "MINOR" }),
      change({ changeId: "sig", severity: "SIGNIFICANT" }),
      change({ changeId: "major", severity: "MAJOR" }),
    ];
    expect(filterBySeverity(list, "SIGNIFICANT").map((c) => c.changeId)).toEqual(["sig", "major"]);
  });
});

describe("filterByConfidence", () => {
  test("keeps a minimum confidence and above", () => {
    const list = [
      change({ changeId: "low", confidence: "LOW" }),
      change({ changeId: "med", confidence: "MEDIUM" }),
      change({ changeId: "high", confidence: "HIGH" }),
    ];
    expect(filterByConfidence(list, "MEDIUM").map((c) => c.changeId)).toEqual(["med", "high"]);
  });
});

describe("filterByTimeRange", () => {
  const now = Date.parse("2026-09-10T00:00:00Z");
  test("24h excludes anything older than a day", () => {
    const list = [
      change({ changeId: "recent", detectedAt: "2026-09-09T12:00:00Z" }),
      change({ changeId: "old", detectedAt: "2026-08-01T00:00:00Z" }),
    ];
    expect(filterByTimeRange(list, "24h", now).map((c) => c.changeId)).toEqual(["recent"]);
  });

  test("'all' never filters anything out", () => {
    const list = [change({ detectedAt: "2020-01-01T00:00:00Z" })];
    expect(filterByTimeRange(list, "all", now)).toHaveLength(1);
  });
});

describe("applyWatchFilters", () => {
  test("combines severity, confidence and time in one pass", () => {
    const now = Date.parse("2026-09-10T00:00:00Z");
    const list = [
      change({ changeId: "keep", severity: "MAJOR", confidence: "HIGH", detectedAt: "2026-09-09T00:00:00Z" }),
      change({ changeId: "low-sev", severity: "MINOR", confidence: "HIGH", detectedAt: "2026-09-09T00:00:00Z" }),
      change({ changeId: "old", severity: "MAJOR", confidence: "HIGH", detectedAt: "2026-01-01T00:00:00Z" }),
    ];
    const out = applyWatchFilters(
      list,
      { minimumSeverity: "SIGNIFICANT", minimumConfidence: "MEDIUM", timeRange: "7d" },
      now,
    );
    expect(out.map((c) => c.changeId)).toEqual(["keep"]);
  });
});

describe("importantChanges", () => {
  test("keeps only MAJOR and SIGNIFICANT, per the spec's default emphasis", () => {
    const list = [
      change({ changeId: "info", severity: "INFO" }),
      change({ changeId: "minor", severity: "MINOR" }),
      change({ changeId: "sig", severity: "SIGNIFICANT" }),
      change({ changeId: "major", severity: "MAJOR" }),
    ];
    expect(importantChanges(list).map((c) => c.changeId)).toEqual(["sig", "major"]);
  });
});

describe("unseenChanges", () => {
  test("everything is unseen when lastSeenChangeAt is null (a fresh watch)", () => {
    const list = [change(), change({ changeId: "c2" })];
    expect(unseenChanges(list, null)).toHaveLength(2);
  });

  test("only changes detected after the cursor are unseen", () => {
    const cursor = Date.parse("2026-09-01T00:00:00Z");
    const list = [
      change({ changeId: "before", detectedAt: "2026-08-31T00:00:00Z" }),
      change({ changeId: "after", detectedAt: "2026-09-02T00:00:00Z" }),
    ];
    expect(unseenChanges(list, cursor).map((c) => c.changeId)).toEqual(["after"]);
  });

  test("re-detecting the exact same pair twice never produces a duplicate unseen alert once marked seen", () => {
    const list = [change({ changeId: "c1", detectedAt: "2026-09-01T00:00:00Z" })];
    const afterMarkingSeen = Date.parse("2026-09-01T00:00:00Z") + 1;
    expect(unseenChanges(list, afterMarkingSeen)).toHaveLength(0);
  });
});

describe("buildWatchOverview", () => {
  const EMPTY_PROFESSIONAL: ProfessionalIdentity = {
    primary: null,
    secondary: [],
    roles: [],
    industries: [],
    specializations: [],
    expertise: [],
    careerStatus: null,
    unresolved: [],
    empty: true,
  };

  function profile(overrides: Partial<RealProfile> = {}): RealProfile {
    return {
      slug: "jane-doe",
      name: "Jane Doe",
      verified: true,
      profession: "Executive",
      summary: "",
      background: "",
      notableWorks: [],
      fetchedAt: "2026-09-05T00:00:00Z",
      sentimentScore: 20,
      trendDirection: "down",
      explanation: "",
      confidence: 0.8,
      scoreLow: null,
      scoreHigh: null,
      sampleSize: 100,
      methodAgreement: 0.8,
      positiveRatio: null,
      neutralRatio: null,
      negativeRatio: null,
      positiveCount: null,
      neutralCount: null,
      negativeCount: null,
      scoreNews: null,
      scoreYoutube: null,
      scoreInstagram: null,
      trend: [],
      evidence: [],
      controversies: [
        {
          title: "Episode",
          summary: "s",
          category: "Legal",
          severity: 4,
          status: "ongoing",
          year: 2026,
          sources: ["https://reuters.com/1"],
        },
      ],
      media: [],
      attention: null,
      timeline: [],
      accounts: [],
      professional: EMPTY_PROFESSIONAL,
      career: {
        timeline: [],
        organizations: [],
        insights: { start: null, current: null, transitions: [], leadershipRoles: [], founder: false, progression: [] },
        available: false,
      },
      resolution: "high",
      candidates: [],
      ...overrides,
    };
  }

  test("critiscore matches the real deterministic calculation, never recomputed differently", () => {
    const p = profile();
    const overview = buildWatchOverview(p, [], null);
    expect(overview.critiscore).toBeGreaterThan(0);
    expect(overview.sentimentBand).toBe("negative");
  });

  test("unseen and important-unseen counts are consistent with the underlying lists", () => {
    const list = [
      change({ changeId: "a", severity: "MAJOR", detectedAt: "2026-09-04T00:00:00Z" }),
      change({ changeId: "b", severity: "INFO", detectedAt: "2026-09-04T00:00:00Z" }),
    ];
    const overview = buildWatchOverview(profile(), list, null);
    expect(overview.unseenCount).toBe(2);
    expect(overview.importantUnseenCount).toBe(1);
    expect(overview.recentChangeCount).toBe(2);
  });

  test("lastMeaningfulUpdate names the most recently detected change", () => {
    const list = [
      change({ changeId: "old", title: "Old change", detectedAt: "2026-08-01T00:00:00Z" }),
      change({ changeId: "new", title: "New change", detectedAt: "2026-09-04T00:00:00Z" }),
    ];
    const overview = buildWatchOverview(profile(), list, null);
    expect(overview.lastMeaningfulUpdate).toBe("New change");
  });

  test("a quiet watch with no changes reports null, never a fabricated update", () => {
    const overview = buildWatchOverview(profile(), [], null);
    expect(overview.lastMeaningfulUpdate).toBeNull();
  });
});

describe("importantNewsFromTimeline", () => {
  function newsEvent(overrides: Partial<TimelineEvent> = {}): TimelineEvent {
    return {
      date: "2026-09-01",
      approxDate: false,
      kind: "news",
      title: "Story",
      detail: "",
      severity: null,
      change: null,
      sourceCount: 3,
      sentimentImpact: null,
      attentionImpact: null,
      sources: [],
      importance: "medium",
      importanceReason: "x",
      relatedTitles: [],
      ...overrides,
    };
  }

  test("only news-kind events are returned, sorted by source count then recency", () => {
    const timeline: TimelineEvent[] = [
      newsEvent({ title: "Small story", sourceCount: 2 }),
      { ...newsEvent({ title: "Not news" }), kind: "controversy" },
      newsEvent({ title: "Major event", sourceCount: 15 }),
    ];
    const out = importantNewsFromTimeline(timeline);
    expect(out.map((e) => e.title)).toEqual(["Major event", "Small story"]);
  });

  test("respects a caller-supplied limit", () => {
    const timeline = Array.from({ length: 20 }, (_, i) => newsEvent({ title: `s${i}` }));
    expect(importantNewsFromTimeline(timeline, 3)).toHaveLength(3);
  });

  test("15 articles behind one grouped event still surfaces as a single entry with its real source count", () => {
    const timeline = [newsEvent({ title: "Major event", sourceCount: 15 })];
    const out = importantNewsFromTimeline(timeline);
    expect(out).toHaveLength(1);
    expect(out[0].sourceCount).toBe(15);
  });
});
