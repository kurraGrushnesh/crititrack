import { describe, expect, it } from "vitest";
import { computeControversyIndex } from "./controversy-index";
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
