import { describe, expect, it } from "vitest";
import {
  parseComparisons,
  upsertComparison,
  removeComparison,
  renameComparison,
  comparisonToQuery,
  comparisonId,
  type SavedComparison,
} from "./comparisons";

const cmp = (over: Partial<SavedComparison> = {}): SavedComparison => ({
  id: "cmp_1",
  label: "Streaming CEOs",
  members: [
    { slug: "a", name: "A" },
    { slug: "b", name: "B" },
  ],
  ...over,
});

describe("parseComparisons", () => {
  it("reads a well-formed list", () => {
    expect(parseComparisons(JSON.stringify([cmp()]))).toEqual([cmp()]);
  });

  it("drops comparisons with fewer than two valid members", () => {
    expect(
      parseComparisons(
        JSON.stringify([{ id: "x", label: "Solo", members: [{ slug: "a" }] }]),
      ),
    ).toEqual([]);
  });

  it("drops entries missing an id or label, and junk", () => {
    expect(parseComparisons('[{"label":"no id","members":[]}]')).toEqual([]);
    expect(parseComparisons("not json")).toEqual([]);
    expect(parseComparisons(null)).toEqual([]);
  });

  it("dedupes members by slug and caps the length", () => {
    const raw = JSON.stringify([
      {
        id: "x",
        label: "Many",
        members: Array.from({ length: 10 }, (_, i) => ({ slug: `s${i}` })).concat(
          [{ slug: "s0" }],
        ),
      },
    ]);
    expect(parseComparisons(raw)[0].members).toHaveLength(6);
  });
});

describe("upsertComparison", () => {
  it("replaces an existing comparison with the same label", () => {
    const start = [cmp()];
    const next = upsertComparison(start, cmp({ id: "cmp_2", label: "streaming ceos  " }));
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe("cmp_2");
  });

  it("refuses a comparison with fewer than two members", () => {
    const start = [cmp()];
    expect(
      upsertComparison(start, cmp({ id: "cmp_9", members: [{ slug: "x", name: "X" }] })),
    ).toBe(start);
  });
});

describe("removeComparison / renameComparison", () => {
  it("removes by id", () => {
    expect(removeComparison([cmp()], "cmp_1")).toEqual([]);
  });
  it("renames by id and ignores a blank name", () => {
    expect(renameComparison([cmp()], "cmp_1", " New ")[0].label).toBe("New");
    expect(renameComparison([cmp()], "cmp_1", "   ")[0].label).toBe("Streaming CEOs");
  });
});

describe("comparisonToQuery / comparisonId", () => {
  it("joins slugs for the compare screen", () => {
    expect(comparisonToQuery(cmp())).toBe("a,b");
  });
  it("mints distinct ids", () => {
    expect(comparisonId(1)).not.toBe(comparisonId(1));
  });
});
