import { describe, expect, it } from "vitest";
import { searchCoverage, queryTerms, matchRanges } from "./coverage-search";
import type { MediaLink } from "./api";

const item = (over: Partial<MediaLink>): MediaLink => ({
  id: "1",
  title: "t",
  url: "https://x",
  source: "Reuters",
  type: "news",
  sentimentScore: null,
  ...over,
});

const media: MediaLink[] = [
  item({ id: "1", title: "Star wins lawsuit over royalties" }),
  item({ id: "2", title: "Tour dates announced", description: "Stadium run" }),
  item({ id: "3", title: "Café appearance", source: "Le Monde" }),
];

describe("queryTerms", () => {
  it("folds case and accents and splits on whitespace", () => {
    expect(queryTerms("  Café  LAWSUIT ")).toEqual(["cafe", "lawsuit"]);
    expect(queryTerms("   ")).toEqual([]);
  });
});

describe("searchCoverage", () => {
  it("returns the list unchanged for a blank query", () => {
    expect(searchCoverage(media, "  ")).toBe(media);
  });

  it("AND-combines terms across title, description and source", () => {
    expect(searchCoverage(media, "star lawsuit").map((m) => m.id)).toEqual(["1"]);
    expect(searchCoverage(media, "stadium").map((m) => m.id)).toEqual(["2"]);
    expect(searchCoverage(media, "cafe").map((m) => m.id)).toEqual(["3"]);
  });

  it("keeps original order and drops non-matches", () => {
    expect(searchCoverage(media, "announced xyz")).toEqual([]);
  });
});

describe("matchRanges", () => {
  it("returns merged, sorted highlight ranges", () => {
    expect(matchRanges("Lawsuit and lawsuit", "lawsuit")).toEqual([
      [0, 7],
      [12, 19],
    ]);
  });

  it("merges overlapping term hits", () => {
    expect(matchRanges("network", "net work")).toEqual([[0, 7]]);
  });
});
