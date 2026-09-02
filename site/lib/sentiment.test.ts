import { describe, expect, it } from "vitest";
import {
  sentimentBand,
  sentimentColorVar,
  sentimentComposition,
  sentimentLabel,
} from "./sentiment";

describe("sentimentBand", () => {
  it("splits at 65 and 40, matching the app palette", () => {
    expect(sentimentBand(80)).toBe("positive");
    expect(sentimentBand(65)).toBe("positive");
    expect(sentimentBand(64)).toBe("mixed");
    expect(sentimentBand(40)).toBe("mixed");
    expect(sentimentBand(39)).toBe("negative");
    expect(sentimentBand(0)).toBe("negative");
  });
});

describe("sentimentColorVar", () => {
  it("maps each band to its palette token", () => {
    expect(sentimentColorVar(70)).toBe("var(--good)");
    expect(sentimentColorVar(50)).toBe("var(--mid)");
    expect(sentimentColorVar(20)).toBe("var(--bad)");
  });
});

describe("sentimentLabel", () => {
  it("describes the band in words", () => {
    expect(sentimentLabel(70)).toMatch(/positive/);
    expect(sentimentLabel(50)).toMatch(/mixed/);
    expect(sentimentLabel(20)).toMatch(/negative/);
  });
});

describe("sentimentComposition", () => {
  it("returns fixed positive/neutral/negative order with fractions summing to 1", () => {
    const { slices, total } = sentimentComposition({
      positive: 6,
      neutral: 5,
      negative: 0,
    });
    expect(total).toBe(11);
    expect(slices.map((s) => s.key)).toEqual([
      "positive",
      "neutral",
      "negative",
    ]);
    expect(slices.reduce((n, s) => n + s.fraction, 0)).toBeCloseTo(1);
    expect(slices[0].fraction).toBeCloseTo(6 / 11);
  });

  it("keeps zero-count slices in the list with a zero fraction", () => {
    const { slices } = sentimentComposition({
      positive: 3,
      neutral: 0,
      negative: 1,
    });
    expect(slices[1]).toMatchObject({ key: "neutral", count: 0, fraction: 0 });
  });

  it("reports total 0 and all-zero fractions for an empty sample", () => {
    const { slices, total } = sentimentComposition({
      positive: 0,
      neutral: 0,
      negative: 0,
    });
    expect(total).toBe(0);
    expect(slices.every((s) => s.fraction === 0)).toBe(true);
  });

  it("clamps negative inputs to zero", () => {
    const { slices, total } = sentimentComposition({
      positive: -4,
      neutral: 2,
      negative: 0,
    });
    expect(total).toBe(2);
    expect(slices[0].count).toBe(0);
  });

  it("assigns each slice its own colour token", () => {
    const { slices } = sentimentComposition({
      positive: 1,
      neutral: 1,
      negative: 1,
    });
    expect(slices.map((s) => s.colorVar)).toEqual([
      "var(--senti-pos)",
      "var(--senti-neu)",
      "var(--senti-neg)",
    ]);
  });
});
