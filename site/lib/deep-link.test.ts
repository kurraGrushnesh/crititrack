import { describe, expect, it } from "vitest";
import {
  controversyAnchor,
  eventAnchor,
  parseProfileHash,
  profileLink,
  comparisonLink,
  parseComparisonQuery,
} from "./deep-link";

describe("anchors", () => {
  it("controversyAnchor folds a title to a stable slug", () => {
    expect(controversyAnchor("Café royalties dispute (2019)")).toBe(
      "controversy-cafe-royalties-dispute-2019",
    );
  });
  it("eventAnchor stamps a date", () => {
    expect(eventAnchor("2026-03-04")).toBe("event-2026-03-04");
  });
});

describe("parseProfileHash", () => {
  it("recognises a known section", () => {
    expect(parseProfileHash("#sentiment").section).toBe("sentiment");
  });
  it("recognises a controversy anchor and a timeline event", () => {
    expect(parseProfileHash("controversy-tax-dispute").controversyAnchor).toBe(
      "controversy-tax-dispute",
    );
    expect(parseProfileHash("#event-2026-03-04").eventDate).toBe("2026-03-04");
  });
  it("returns all-null for junk or an empty hash", () => {
    expect(parseProfileHash("#nonsense")).toEqual({
      section: null,
      controversyAnchor: null,
      eventDate: null,
    });
    expect(parseProfileHash("")).toEqual({
      section: null,
      controversyAnchor: null,
      eventDate: null,
    });
  });
});

describe("links", () => {
  it("profileLink encodes the name and appends a fragment", () => {
    expect(profileLink("N. T. Rama Rao", "controversies")).toBe(
      "/figure/?q=N.%20T.%20Rama%20Rao#controversies",
    );
    expect(profileLink("Zendaya")).toBe("/figure/?q=Zendaya");
  });

  it("comparisonLink dedupes, trims and caps at six", () => {
    expect(comparisonLink([" a ", "a", "b", "c", "d", "e", "f", "g"])).toBe(
      "/compare/?figures=a,b,c,d,e,f",
    );
  });

  it("parseComparisonQuery is the inverse", () => {
    expect(parseComparisonQuery("a, b ,a,c")).toEqual(["a", "b", "c"]);
    expect(parseComparisonQuery(null)).toEqual([]);
  });
});
