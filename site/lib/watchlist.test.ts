import { describe, expect, it } from "vitest";
import { parseWatchlist, isWatched, toggledWatchlist } from "./watchlist";

describe("parseWatchlist", () => {
  it("reads the current { slug, name } format", () => {
    expect(
      parseWatchlist('[{"slug":"taylor-swift","name":"Taylor Swift"}]'),
    ).toEqual([{ slug: "taylor-swift", name: "Taylor Swift" }]);
  });

  it("migrates the old bare-slug array", () => {
    expect(parseWatchlist('["taylor-swift","zendaya"]')).toEqual([
      { slug: "taylor-swift", name: "taylor-swift" },
      { slug: "zendaya", name: "zendaya" },
    ]);
  });

  it("fills a missing name from the slug", () => {
    expect(parseWatchlist('[{"slug":"x"}]')).toEqual([{ slug: "x", name: "x" }]);
  });

  it("drops malformed entries and handles junk", () => {
    expect(parseWatchlist('[{"name":"no slug"},42,null]')).toEqual([]);
    expect(parseWatchlist("not json")).toEqual([]);
    expect(parseWatchlist(null)).toEqual([]);
    expect(parseWatchlist("{}")).toEqual([]);
  });
});

describe("isWatched", () => {
  const list = [
    { slug: "a", name: "A" },
    { slug: "b", name: "B" },
  ];
  it("matches by slug", () => {
    expect(isWatched(list, "a")).toBe(true);
    expect(isWatched(list, "c")).toBe(false);
    expect(isWatched([], "a")).toBe(false);
  });
});

describe("toggledWatchlist", () => {
  it("adds when absent, removes when present", () => {
    const added = toggledWatchlist([], "a", "A");
    expect(added).toEqual([{ slug: "a", name: "A" }]);
    expect(toggledWatchlist(added, "a", "A")).toEqual([]);
  });
});
