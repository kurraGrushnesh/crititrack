import { describe, expect, it } from "vitest";
import {
  sentimentConfidence,
  factConfidence,
  corroborationConfidence,
} from "./confidence";

describe("sentimentConfidence", () => {
  it("bands the 0..1 value into three consistent levels", () => {
    expect(sentimentConfidence(0.9).level).toBe("high");
    expect(sentimentConfidence(0.6).level).toBe("moderate");
    expect(sentimentConfidence(0.2).level).toBe("low");
  });

  it("treats a non-finite value as low, not an error", () => {
    expect(sentimentConfidence(NaN).level).toBe("low");
  });

  it("gives every badge a label, icon and gloss", () => {
    const b = sentimentConfidence(0.8);
    expect(b.label).toBe("High confidence");
    expect(b.icon).toBe("check-double");
    expect(b.gloss.length).toBeGreaterThan(10);
  });
});

describe("factConfidence", () => {
  it("maps Wikidata precision onto the shared scale", () => {
    expect(factConfidence("day").level).toBe("high");
    expect(factConfidence("year").level).toBe("moderate");
    expect(factConfidence("century").level).toBe("low");
    expect(factConfidence("unknown").level).toBe("low");
  });
});

describe("corroborationConfidence", () => {
  it("is high when supported", () => {
    expect(corroborationConfidence(true, 2).level).toBe("high");
  });

  it("is low when unsupported, with severity-aware wording", () => {
    expect(corroborationConfidence(false, 5).gloss).toMatch(/would have been dropped/);
    expect(corroborationConfidence(false, 2).gloss).toMatch(/because it is minor/);
  });
});
