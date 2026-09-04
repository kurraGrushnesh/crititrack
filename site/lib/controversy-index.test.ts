import { describe, expect, it } from "vitest";
import {
  computeControversyIndex,
  explainControversyIndex,
  scoreBand,
  indexConfidence,
  indexAsOf,
  indexChange,
  indexHistory,
} from "./controversy-index";
import type { Controversy } from "./controversy";
import { parseControversy } from "./controversy";

/**
 * Ported from `test/controversy_index_test.dart`. The web and Flutter
 * indexes must produce the same number for the same input, so these
 * cases mirror the Dart suite one for one, plus a cross-check that both
 * implementations agree on a shared fixture.
 */

function c(
  overrides: Partial<Controversy> = {},
): Controversy {
  return {
    title: "Episode",
    summary: "summary",
    category: "Other",
    severity: 3,
    status: "historical",
    sources: [],
    ...overrides,
  };
}

describe("computeControversyIndex", () => {
  it("empty list scores 0", () => {
    const r = computeControversyIndex([]);
    expect(r.score).toBe(0);
    expect(r.total).toBe(0);
    expect(r.peakSeverity).toBe(0);
  });

  it("single recent severe episode lands mid-range", () => {
    const r = computeControversyIndex([c({ severity: 5, year: 2025 })], 2026);
    expect(r.score).toBeGreaterThan(40);
    expect(r.score).toBeLessThan(60);
    expect(r.peakSeverity).toBe(5);
  });

  it("more episodes push the score higher (diminishing returns)", () => {
    const one = computeControversyIndex(
      [c({ severity: 4, year: 2025 })],
      2026,
    ).score;
    const many = computeControversyIndex(
      Array.from({ length: 5 }, () => c({ severity: 4, year: 2025 })),
      2026,
    ).score;
    expect(many).toBeGreaterThan(one);
    expect(many).toBeLessThan(100);
  });

  it("old episodes weigh less than recent ones", () => {
    const recent = computeControversyIndex(
      [c({ severity: 4, year: 2025 })],
      2026,
    ).score;
    const old = computeControversyIndex(
      [c({ severity: 4, year: 2005 })],
      2026,
    ).score;
    expect(old).toBeLessThan(recent);
  });

  it("unknown year is discounted relative to a recent known year", () => {
    const known = computeControversyIndex(
      [c({ severity: 4, year: 2026 })],
      2026,
    ).score;
    const unknown = computeControversyIndex(
      [c({ severity: 4, year: undefined })],
      2026,
    ).score;
    expect(unknown).toBeLessThan(known);
  });

  it("ongoing status increases weight and is counted", () => {
    const resolved = computeControversyIndex(
      [c({ severity: 3, year: 2025, status: "resolved" })],
      2026,
    );
    const ongoing = computeControversyIndex(
      [c({ severity: 3, year: 2025, status: "ongoing" })],
      2026,
    );
    expect(ongoing.score).toBeGreaterThan(resolved.score);
    expect(ongoing.ongoingCount).toBe(1);
    expect(resolved.ongoingCount).toBe(0);
  });

  it("score never exceeds 100", () => {
    const r = computeControversyIndex(
      Array.from({ length: 20 }, () =>
        c({ severity: 5, year: 2026, status: "ongoing" }),
      ),
      2026,
    );
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it("recency decay has a 0.4 floor, so very old episodes still register", () => {
    const ancient = computeControversyIndex(
      [c({ severity: 5, year: 1970 })],
      2026,
    ).score;
    // 0.4 floor * (5/5) severity => weighted 0.4 => 100*(1 - 1/1.4)
    expect(ancient).toBeCloseTo(28.571, 2);
  });

  it("label bands track the score", () => {
    expect(computeControversyIndex([]).label).toBe(
      "No documented controversies",
    );
    const high = computeControversyIndex(
      Array.from({ length: 6 }, () =>
        c({ severity: 5, year: 2026, status: "ongoing" }),
      ),
      2026,
    );
    expect(["Highly controversial", "Lightning rod"]).toContain(high.label);
  });

  it("defaults currentYear to the calendar year when omitted", () => {
    const thisYear = new Date().getFullYear();
    const withDefault = computeControversyIndex([
      c({ severity: 3, year: thisYear - 1 }),
    ]).score;
    const explicit = computeControversyIndex(
      [c({ severity: 3, year: thisYear - 1 })],
      thisYear,
    ).score;
    expect(withDefault).toBe(explicit);
  });
});

describe("parity fixture (must match the Dart suite's expectations)", () => {
  it("known mixed list", () => {
    const items = [
      c({ severity: 5, year: 2025, status: "ongoing" }),
      c({ severity: 3, year: 2020, status: "resolved" }),
      c({ severity: 2, year: undefined, status: "historical" }),
    ];
    const r = computeControversyIndex(items, 2026);
    // weighted =
    //   (5/5)*1*1.25            = 1.25
    // + (3/5)*(1-(6-2)*0.06)    = 0.6 * 0.76 = 0.456
    // + (2/5)*0.7               = 0.28
    // = 1.986
    // score = 100*(1 - 1/2.986) = 66.5104...
    expect(r.score).toBeCloseTo(66.5104, 3);
    expect(r.peakSeverity).toBe(5);
    expect(r.ongoingCount).toBe(1);
    expect(r.total).toBe(3);
    expect(r.label).toBe("Highly controversial");
  });
});

describe("explainControversyIndex", () => {
  it("row points sum to the score and rows are ordered by contribution", () => {
    const items = [
      c({ title: "Big", severity: 5, year: 2025, status: "ongoing" }),
      c({ title: "Small", severity: 2, year: 2010, status: "historical" }),
    ];
    const ex = explainControversyIndex(items, 2026);
    const sum = ex.rows.reduce((t, r) => t + r.points, 0);
    expect(sum).toBeCloseTo(ex.score, 6);
    expect(ex.rows[0].title).toBe("Big");
    expect(ex.rows[0].ongoingFactor).toBe(1.25);
  });

  it("breaks an episode into severity, recency and ongoing factors", () => {
    const [row] = explainControversyIndex(
      [c({ severity: 3, year: 2018, status: "historical" })],
      2026,
    ).rows;
    expect(row.severityBase).toBeCloseTo(0.6, 6);
    // age 8 -> 1 - (8-2)*0.06 = 0.64
    expect(row.recencyFactor).toBeCloseTo(0.64, 6);
    expect(row.ongoingFactor).toBe(1);
    expect(row.weight).toBeCloseTo(0.6 * 0.64, 6);
  });

  it("is empty and zero for no controversies", () => {
    const ex = explainControversyIndex([], 2026);
    expect(ex.score).toBe(0);
    expect(ex.rows).toEqual([]);
  });
});

describe("scoreBand", () => {
  it("matches the spec's five ranges", () => {
    expect(scoreBand(0).band).toBe("Very Low");
    expect(scoreBand(19).band).toBe("Very Low");
    expect(scoreBand(20).band).toBe("Low");
    expect(scoreBand(39).band).toBe("Low");
    expect(scoreBand(40).band).toBe("Moderate");
    expect(scoreBand(59).band).toBe("Moderate");
    expect(scoreBand(60).band).toBe("High");
    expect(scoreBand(79).band).toBe("High");
    expect(scoreBand(80).band).toBe("Very High");
    expect(scoreBand(100).band).toBe("Very High");
  });

  it("clamps out-of-range input rather than throwing", () => {
    expect(scoreBand(-5).band).toBe("Very Low");
    expect(scoreBand(150).band).toBe("Very High");
  });
});

describe("indexConfidence", () => {
  it("is null for no episodes — nothing to rate", () => {
    expect(indexConfidence([])).toBeNull();
  });

  it("is High when every episode is sourced and dated", () => {
    const conf = indexConfidence([
      c({ sources: ["Reuters"], year: 2024 }),
      c({ sources: ["AP"], year: 2023 }),
    ]);
    expect(conf?.level).toBe("High");
    expect(conf?.sourcedRatio).toBe(1);
    expect(conf?.datedRatio).toBe(1);
  });

  it("is Low when most episodes are unsourced and undated", () => {
    const conf = indexConfidence([
      c({ sources: [], year: undefined }),
      c({ sources: [], year: undefined }),
      c({ sources: ["AP"], year: 2020 }),
    ]);
    expect(conf?.level).toBe("Low");
  });

  it("the reason string names the real counts, not a vague claim", () => {
    const conf = indexConfidence([
      c({ sources: ["AP"], year: 2020 }),
      c({ sources: [], year: undefined }),
    ]);
    expect(conf?.reason).toBe("1 of 2 episodes sourced, 1 of 2 dated");
  });
});

describe("indexAsOf", () => {
  it("excludes an episode dated after the cutoff", () => {
    const items = [c({ severity: 5, year: 2020 }), c({ severity: 5, year: 2025 })];
    const asOf2021 = indexAsOf(items, 2021);
    expect(asOf2021.total).toBe(1);
  });

  it("keeps an undated episode at every point in time", () => {
    const items = [c({ severity: 3, year: undefined })];
    expect(indexAsOf(items, 2010).total).toBe(1);
    expect(indexAsOf(items, 2030).total).toBe(1);
  });
});

describe("indexChange", () => {
  it("is null with nothing dated before the current year", () => {
    expect(indexChange([c({ year: 2026 })], 2026)).toBeNull();
    expect(indexChange([c({ year: undefined })], 2026)).toBeNull();
  });

  it("reports a real delta when an earlier-dated episode exists", () => {
    const items = [c({ severity: 3, year: 2020 }), c({ severity: 5, year: 2026 })];
    const change = indexChange(items, 2026);
    expect(change).not.toBeNull();
    expect(change!.previousYear).toBe(2025);
    expect(change!.current).toBeGreaterThan(change!.previous);
    expect(change!.delta).toBeCloseTo(change!.current - change!.previous);
  });
});

describe("indexHistory", () => {
  it("is empty with fewer than two distinct dated years", () => {
    expect(indexHistory([c({ year: 2024 })], 2026)).toEqual([]);
    expect(indexHistory([c({ year: 2024 }), c({ year: 2024 })], 2026)).toEqual([]);
    expect(indexHistory([c({ year: undefined })], 2026)).toEqual([]);
  });

  it("spans from the earliest dated year through the current year", () => {
    const items = [c({ year: 2023 }), c({ year: 2025 })];
    const h = indexHistory(items, 2026);
    expect(h.map((p) => p.year)).toEqual([2023, 2024, 2025, 2026]);
    // Monotonic-ish sanity: the final point matches computeControversyIndex.
    expect(h[h.length - 1].score).toBeCloseTo(
      computeControversyIndex(items, 2026).score,
    );
  });
});

describe("parseControversy", () => {
  it("normalizes category and clamps severity", () => {
    const ctrl = parseControversy({
      title: "X",
      category: "a messy court battle",
      severity: 9,
      status: "still active",
    });
    expect(ctrl.category).toBe("Legal");
    expect(ctrl.severity).toBe(5);
    expect(ctrl.status).toBe("ongoing");
  });
});
