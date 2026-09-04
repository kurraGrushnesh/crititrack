import { describe, expect, it } from "vitest";
import { ROSTER, type RosterEntry } from "./catalog";
import {
  CATEGORIES,
  ALL_CATEGORY_SLUGS,
  categoryBySlug,
  canonicalCategorySlug,
  categoriesFor,
  categoryCounts,
  rosterForCategory,
} from "./categories";

const entry = (over: Partial<RosterEntry>): RosterEntry => ({
  name: "Test Person",
  category: "actors",
  descriptor: "American film actor",
  born: 1980,
  ...over,
});

describe("category list", () => {
  it("has 35 categories, each with a unique slug and a real blurb", () => {
    expect(CATEGORIES).toHaveLength(35);
    const slugs = new Set(CATEGORIES.map((c) => c.slug));
    expect(slugs.size).toBe(35);
    for (const c of CATEGORIES) expect(c.blurb.length).toBeGreaterThan(10);
  });

  it("carries at least the featured legacy categories", () => {
    const featured = CATEGORIES.filter((c) => c.featured).map((c) => c.slug);
    expect(featured).toContain("actors-filmmakers");
    expect(featured).toContain("technology");
  });
});

describe("legacy slug aliases", () => {
  it("resolves every old 6-category slug to its replacement", () => {
    for (const old of ["actors", "politicians", "athletes", "musicians", "business", "creators"]) {
      expect(categoryBySlug(old)).toBeDefined();
      expect(canonicalCategorySlug(old)).not.toBe(old);
    }
  });

  it("the new slug also resolves directly", () => {
    expect(categoryBySlug("actors-filmmakers")?.label).toBe("Actors & Filmmakers");
  });

  it("static export needs a page for every old and new slug", () => {
    expect(ALL_CATEGORY_SLUGS).toContain("actors");
    expect(ALL_CATEGORY_SLUGS).toContain("actors-filmmakers");
    expect(new Set(ALL_CATEGORY_SLUGS).size).toBe(ALL_CATEGORY_SLUGS.length);
  });
});

describe("categoriesFor — taxonomy classification", () => {
  it("classifies a straightforward descriptor onto its category", () => {
    const c = categoriesFor(entry({ descriptor: "Indian javelin thrower", category: "athletes" }));
    expect(c.map((x) => x.slug)).toContain("athletes-sports");
  });

  it("classifies a co-founder as both an entrepreneur and a business leader", () => {
    const c = categoriesFor(
      entry({ descriptor: "Co-founder of Netflix", category: "business" }),
    );
    const slugs = c.map((x) => x.slug);
    expect(slugs).toContain("entrepreneurs-founders");
    expect(slugs).toContain("business-leaders");
  });

  it("never leaves a real roster entry with zero categories", () => {
    for (const e of ROSTER) expect(categoriesFor(e).length).toBeGreaterThan(0);
  });

  it("falls back to the legacy category when the descriptor does not resolve", () => {
    const c = categoriesFor(
      entry({ descriptor: "Fabricated composite descriptor xyz", category: "musicians" }),
    );
    expect(c.map((x) => x.slug)).toContain("musicians-singers");
  });

  it("never invents a category with no taxonomy or legacy basis", () => {
    // A junk category on the entry with a resolvable descriptor: only the
    // taxonomy match should come back, no legacy category for "junk".
    const c = categoriesFor(
      entry({ descriptor: "American film actor", category: "junk-category" }),
    );
    expect(c.map((x) => x.slug)).toEqual(["actors-filmmakers"]);
  });

  it("a stage actor is grouped with performers, not musicians", () => {
    const c = categoriesFor(
      entry({ descriptor: "American film and stage actor", category: "actors" }),
    );
    const slugs = c.map((x) => x.slug);
    expect(slugs).toContain("actors-filmmakers");
    expect(slugs).not.toContain("musicians-singers");
  });
});

describe("rosterForCategory", () => {
  it("returns the same people for an old slug and its replacement", () => {
    const oldWay = rosterForCategory("actors", ROSTER);
    const newWay = rosterForCategory("actors-filmmakers", ROSTER);
    expect(oldWay.map((e) => e.name).sort()).toEqual(newWay.map((e) => e.name).sort());
    expect(oldWay.length).toBeGreaterThan(0);
  });

  it("an unknown slug returns nothing rather than the whole roster", () => {
    expect(rosterForCategory("not-a-real-category", ROSTER)).toEqual([]);
  });
});

describe("categoryCounts", () => {
  it("counts every category, including empty ones, and never fabricates a total", () => {
    const counts = categoryCounts(ROSTER);
    expect(Object.keys(counts)).toHaveLength(35);
    expect(counts["actors-filmmakers"]).toBeGreaterThan(0);
    // A profession simply absent from today's roster is honestly zero.
    expect(counts["real-estate"]).toBe(0);
    const totalTags = Object.values(counts).reduce((a, b) => a + b, 0);
    // Every person contributes at least one tag, and several contribute
    // more than one, so the tag total exceeds the roster size.
    expect(totalTags).toBeGreaterThanOrEqual(ROSTER.length);
  });
});
