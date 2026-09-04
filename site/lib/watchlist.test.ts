import { describe, expect, it } from "vitest";
import {
  parseWatchlist,
  isWatched,
  toggledWatchlist,
  normalizeTags,
  allTags,
  entriesForTag,
  addTag,
  removeTag,
  renameTag,
  type WatchEntry,
} from "./watchlist";

describe("parseWatchlist", () => {
  it("reads the current format and always yields a tags array", () => {
    expect(
      parseWatchlist('[{"slug":"taylor-swift","name":"Taylor Swift"}]'),
    ).toEqual([{ slug: "taylor-swift", name: "Taylor Swift", tags: [] }]);
  });

  it("migrates the old bare-slug array", () => {
    expect(parseWatchlist('["taylor-swift","zendaya"]')).toEqual([
      { slug: "taylor-swift", name: "taylor-swift", tags: [] },
      { slug: "zendaya", name: "zendaya", tags: [] },
    ]);
  });

  it("fills a missing name from the slug", () => {
    expect(parseWatchlist('[{"slug":"x"}]')).toEqual([
      { slug: "x", name: "x", tags: [] },
    ]);
  });

  it("reads and normalizes stored tags", () => {
    expect(
      parseWatchlist('[{"slug":"x","name":"X","tags":["  B ","a","a",7]}]'),
    ).toEqual([{ slug: "x", name: "X", tags: ["a", "B"] }]);
  });

  it("drops malformed entries and handles junk", () => {
    expect(parseWatchlist('[{"name":"no slug"},42,null]')).toEqual([]);
    expect(parseWatchlist("not json")).toEqual([]);
    expect(parseWatchlist(null)).toEqual([]);
    expect(parseWatchlist("{}")).toEqual([]);
  });
});

describe("isWatched", () => {
  const list: WatchEntry[] = [
    { slug: "a", name: "A", tags: [] },
    { slug: "b", name: "B", tags: [] },
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
    expect(added).toEqual([{ slug: "a", name: "A", tags: [] }]);
    expect(toggledWatchlist(added, "a", "A")).toEqual([]);
  });
});

describe("tags", () => {
  const list: WatchEntry[] = [
    { slug: "a", name: "A", tags: ["Politicians"] },
    { slug: "b", name: "B", tags: ["Politicians", "Close watch"] },
    { slug: "c", name: "C", tags: [] },
  ];

  it("normalizeTags trims, dedupes and sorts", () => {
    expect(normalizeTags([" x", "x", "A", 3, ""])).toEqual(["A", "x"]);
  });

  it("allTags lists every tag once, sorted", () => {
    expect(allTags(list)).toEqual(["Close watch", "Politicians"]);
  });

  it("entriesForTag filters, and null means untagged", () => {
    expect(entriesForTag(list, "Politicians").map((e) => e.slug)).toEqual([
      "a",
      "b",
    ]);
    expect(entriesForTag(list, null).map((e) => e.slug)).toEqual(["c"]);
  });

  it("addTag adds to one entry and keeps tags normalized", () => {
    const next = addTag(list, "c", " New ");
    expect(next[2].tags).toEqual(["New"]);
  });

  it("addTag is a content no-op when the tag is already present", () => {
    expect(addTag(list, "a", "Politicians")[0].tags).toEqual(["Politicians"]);
  });

  it("removeTag removes from one entry or all", () => {
    expect(removeTag(list, "a", "Politicians")[0].tags).toEqual([]);
    expect(removeTag(list, null, "Politicians").every((e) => !e.tags.includes("Politicians"))).toBe(true);
  });

  it("renameTag rewrites the tag everywhere", () => {
    const next = renameTag(list, "Politicians", "Gov");
    expect(allTags(next)).toEqual(["Close watch", "Gov"]);
  });
});
