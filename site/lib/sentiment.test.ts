import { describe, expect, it } from "vitest";
import { sentimentBand, sentimentColorVar, sentimentLabel } from "./sentiment";

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
