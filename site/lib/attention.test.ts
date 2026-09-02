import { describe, expect, it } from "vitest";
import {
  attentionGeometry,
  changeLabel,
  formatCompact,
  shortDate,
} from "./attention";

describe("formatCompact", () => {
  it("abbreviates thousands and millions", () => {
    expect(formatCompact(940)).toBe("940");
    expect(formatCompact(12791)).toBe("13K");
    expect(formatCompact(9400)).toBe("9.4K");
    expect(formatCompact(397483)).toBe("397K");
    expect(formatCompact(1585153)).toBe("1.6M");
    expect(formatCompact(24000000)).toBe("24M");
  });

  it("handles non-finite input", () => {
    expect(formatCompact(NaN)).toBe("—");
  });
});

describe("changeLabel", () => {
  it("names the direction and magnitude", () => {
    expect(changeLabel(43)).toBe("up 43%");
    expect(changeLabel(-8)).toBe("down 8%");
    expect(changeLabel(0)).toBe("flat");
    expect(changeLabel(0.4)).toBe("flat");
  });
});

describe("shortDate", () => {
  it("formats an ISO date as month + day", () => {
    expect(shortDate("2026-07-04")).toBe("Jul 4");
  });
  it("passes through an unparseable string", () => {
    expect(shortDate("not-a-date")).toBe("not-a-date");
  });
});

describe("attentionGeometry", () => {
  const series = [
    { date: "2026-01-01", views: 100 },
    { date: "2026-01-02", views: 50 },
    { date: "2026-01-03", views: 200 },
    { date: "2026-01-04", views: 0 },
  ];

  it("returns null for a series too short to draw", () => {
    expect(attentionGeometry([], 100, 40)).toBeNull();
    expect(attentionGeometry([series[0]], 100, 40)).toBeNull();
  });

  it("spaces points evenly on X and scales Y to the max", () => {
    const g = attentionGeometry(series, 300, 100)!;
    expect(g.maxViews).toBe(200);
    expect(g.points.map((p) => p.x)).toEqual([0, 100, 200, 300]);
    // peak sits at the top (y = 0), a zero day sits on the baseline
    expect(g.points[2].y).toBeCloseTo(0);
    expect(g.points[3].y).toBeCloseTo(100);
    expect(g.peakIndex).toBe(2);
  });

  it("closes the area path back to the baseline", () => {
    const g = attentionGeometry(series, 300, 100)!;
    expect(g.line.startsWith("M0.00,")).toBe(true);
    expect(g.area.endsWith("L0.00,100.00 Z")).toBe(true);
  });

  it("clamps negative views to the baseline", () => {
    const g = attentionGeometry(
      [
        { date: "a", views: 10 },
        { date: "b", views: -5 },
      ],
      100,
      40,
    )!;
    expect(g.points[1].y).toBe(40);
  });
});
