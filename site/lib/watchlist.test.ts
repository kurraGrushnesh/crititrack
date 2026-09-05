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
  markViewed,
  markChangesSeen,
  setNotificationPreferences,
  setWatchFilters,
  defaultNotificationPreferences,
  defaultWatchFilters,
  type WatchEntry,
} from "./watchlist";

/** A full, default-filled entry for tests that don't care about the
 * Watch Intelligence fields beyond their presence. */
function entry(slug: string, name: string, tags: string[] = []): WatchEntry {
  return {
    slug,
    name,
    tags,
    lastViewedAt: null,
    lastSeenChangeAt: null,
    notificationPreferences: defaultNotificationPreferences(),
    filters: defaultWatchFilters(),
  };
}

describe("parseWatchlist", () => {
  it("reads the current format and fills in Watch Intelligence defaults", () => {
    expect(parseWatchlist('[{"slug":"taylor-swift","name":"Taylor Swift"}]')).toEqual([
      entry("taylor-swift", "Taylor Swift"),
    ]);
  });

  it("migrates the old bare-slug array", () => {
    expect(parseWatchlist('["taylor-swift","zendaya"]')).toEqual([
      entry("taylor-swift", "taylor-swift"),
      entry("zendaya", "zendaya"),
    ]);
  });

  it("fills a missing name from the slug", () => {
    expect(parseWatchlist('[{"slug":"x"}]')).toEqual([entry("x", "x")]);
  });

  it("reads and normalizes stored tags", () => {
    expect(parseWatchlist('[{"slug":"x","name":"X","tags":["  B ","a","a",7]}]')).toEqual([
      entry("x", "X", ["a", "B"]),
    ]);
  });

  it("reads Watch Intelligence fields when present, ignores garbage", () => {
    const [e] = parseWatchlist(
      '[{"slug":"x","name":"X","wikidataId":"Q1","lastViewedAt":100,"lastSeenChangeAt":200,' +
        '"notificationPreferences":{"careerChanges":false,"bogus":1},' +
        '"filters":{"minimumSeverity":"MAJOR","minimumConfidence":"nonsense"}}]',
    );
    expect(e.wikidataId).toBe("Q1");
    expect(e.lastViewedAt).toBe(100);
    expect(e.lastSeenChangeAt).toBe(200);
    expect(e.notificationPreferences.careerChanges).toBe(false);
    expect(e.notificationPreferences.organizationChanges).toBe(true); // untouched default
    expect(e.filters.minimumSeverity).toBe("MAJOR");
    expect(e.filters.minimumConfidence).toBe("ALL"); // invalid value falls back to default
  });

  it("drops malformed entries and handles junk", () => {
    expect(parseWatchlist('[{"name":"no slug"},42,null]')).toEqual([]);
    expect(parseWatchlist("not json")).toEqual([]);
    expect(parseWatchlist(null)).toEqual([]);
    expect(parseWatchlist("{}")).toEqual([]);
  });
});

describe("isWatched", () => {
  const list: WatchEntry[] = [entry("a", "A"), entry("b", "B")];
  it("matches by slug", () => {
    expect(isWatched(list, "a")).toBe(true);
    expect(isWatched(list, "c")).toBe(false);
    expect(isWatched([], "a")).toBe(false);
  });
});

describe("toggledWatchlist", () => {
  it("adds when absent, removes when present — no catalogue check involved", () => {
    const added = toggledWatchlist([], "a", "A");
    expect(added).toEqual([entry("a", "A")]);
    expect(toggledWatchlist(added, "a", "A")).toEqual([]);
  });

  it("records a wikidataId when the caller has one, for a globally-discovered entity too", () => {
    const [e] = toggledWatchlist([], "some-researcher", "Some Researcher", "Q999");
    expect(e.wikidataId).toBe("Q999");
  });
});

describe("Watch Intelligence entry mutations", () => {
  const list = [entry("a", "A")];

  it("markViewed sets lastViewedAt only on the matching entry", () => {
    const next = markViewed(list, "a", 12345);
    expect(next[0].lastViewedAt).toBe(12345);
  });

  it("markChangesSeen advances the seen-changes cursor", () => {
    const next = markChangesSeen(list, "a", 999);
    expect(next[0].lastSeenChangeAt).toBe(999);
  });

  it("setNotificationPreferences replaces preferences for one entry only", () => {
    const twoEntries = [entry("a", "A"), entry("b", "B")];
    const prefs = { ...defaultNotificationPreferences(), sentimentChanges: false };
    const next = setNotificationPreferences(twoEntries, "a", prefs);
    expect(next[0].notificationPreferences.sentimentChanges).toBe(false);
    expect(next[1].notificationPreferences.sentimentChanges).toBe(true);
  });

  it("setWatchFilters replaces filters for one entry only", () => {
    const next = setWatchFilters(list, "a", { minimumSeverity: "MAJOR", minimumConfidence: "HIGH", timeRange: "7d" });
    expect(next[0].filters).toEqual({ minimumSeverity: "MAJOR", minimumConfidence: "HIGH", timeRange: "7d" });
  });
});

describe("tags", () => {
  const list: WatchEntry[] = [entry("a", "A", ["Politicians"]), entry("b", "B", ["Politicians", "Close watch"]), entry("c", "C")];

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
