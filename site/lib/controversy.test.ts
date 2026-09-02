import { describe, expect, it } from "vitest";
import {
  corroborated,
  normalizeCategory,
  normalizeStatus,
  parseControversy,
  passesCorroborationGate,
  type Controversy,
} from "./controversy";

function c(overrides: Partial<Controversy> = {}): Controversy {
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

describe("normalizeCategory", () => {
  it("matches an exact category name case-insensitively", () => {
    expect(normalizeCategory("legal")).toBe("Legal");
    expect(normalizeCategory("Social media")).toBe("Social media");
  });

  it("falls back to Other for null and unknowns", () => {
    expect(normalizeCategory(null)).toBe("Other");
    expect(normalizeCategory("something else entirely")).toBe("Other");
  });

  it("keyword-matches near misses", () => {
    expect(normalizeCategory("a lawsuit over royalties")).toBe("Legal");
    expect(normalizeCategory("tax affairs")).toBe("Financial");
    expect(normalizeCategory("a deleted tweet")).toBe("Social media");
    expect(normalizeCategory("election interference")).toBe("Political");
    expect(normalizeCategory("on-set behaviour")).toBe("Professional");
    expect(normalizeCategory("a messy divorce")).toBe("Relationships");
  });
});

describe("normalizeStatus", () => {
  it("maps synonyms to the three statuses", () => {
    expect(normalizeStatus("currently active")).toBe("ongoing");
    expect(normalizeStatus("settled out of court")).toBe("resolved");
    expect(normalizeStatus("from years ago")).toBe("historical");
    expect(normalizeStatus(null)).toBe("historical");
  });
});

describe("parseControversy", () => {
  it("clamps severity into 1..5 and trims the title", () => {
    expect(parseControversy({ severity: 0 }).severity).toBe(1);
    expect(parseControversy({ severity: 99 }).severity).toBe(5);
    expect(parseControversy({ title: "  Padded  " }).title).toBe("Padded");
    expect(parseControversy({ title: "" }).title).toBe("Untitled controversy");
  });

  it("drops blank sources and coerces the rest to trimmed strings", () => {
    expect(
      parseControversy({ sources: ["  Variety ", "", "Reuters"] }).sources,
    ).toEqual(["Variety", "Reuters"]);
  });
});

describe("passesCorroborationGate", () => {
  it("rejects a severity 4-5 claim with no source", () => {
    expect(passesCorroborationGate(c({ severity: 4, sources: [] }))).toBe(false);
    expect(passesCorroborationGate(c({ severity: 5, sources: [] }))).toBe(false);
  });

  it("keeps a severity 4-5 claim that cites a source", () => {
    expect(
      passesCorroborationGate(c({ severity: 5, sources: ["Reuters"] })),
    ).toBe(true);
  });

  it("keeps low-severity claims regardless of sourcing", () => {
    expect(passesCorroborationGate(c({ severity: 3, sources: [] }))).toBe(true);
  });

  it("corroborated() filters a list", () => {
    const kept = corroborated([
      c({ severity: 2, sources: [] }),
      c({ severity: 4, sources: [] }),
      c({ severity: 4, sources: ["Variety"] }),
    ]);
    expect(kept).toHaveLength(2);
  });
});
