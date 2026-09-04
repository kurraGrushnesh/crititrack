import { describe, expect, it } from "vitest";
import {
  CATEGORIES,
  CATEGORY_SLUGS,
  CATEGORY_HINT,
  ROSTER,
  categoryBySlug,
  catalogueProfession,
  decadeOf,
  figureByName,
  figureSlug,
  relatedFigures,
  rosterFor,
  topTen,
} from "./catalog";

/**
 * The catalogue is a labelled mock adapter. These tests pin the two
 * things that matter: it stays internally consistent, and it never
 * carries anything that could read as a claim about a real person.
 */

describe("categories", () => {
  it("has the six required categories with unique slugs", () => {
    expect(CATEGORIES).toHaveLength(6);
    expect(new Set(CATEGORY_SLUGS).size).toBe(6);
    for (const s of ["actors", "politicians", "athletes", "musicians", "business", "creators"]) {
      expect(CATEGORY_SLUGS).toContain(s);
    }
  });

  it("resolves a slug to its category", () => {
    expect(categoryBySlug("athletes")?.label).toBe("Athletes");
    expect(categoryBySlug("nope")).toBeUndefined();
  });
});

describe("roster", () => {
  it("every entry belongs to a real category and has a plausible birth year", () => {
    // `category` is a legacy 6-slug label for the original roster, or
    // one of the newer category keys `CATEGORY_HINT` recognises — either
    // way it must be a real, known tag, never an ad hoc string.
    const knownCategoryTags = new Set([
      ...CATEGORY_SLUGS,
      ...Object.keys(CATEGORY_HINT),
    ]);
    for (const r of ROSTER) {
      expect(knownCategoryTags).toContain(r.category);
      expect(r.born).toBeGreaterThan(1900);
      expect(r.born).toBeLessThan(2015);
      expect(r.name.trim().length).toBeGreaterThan(1);
      expect(r.descriptor.trim().length).toBeGreaterThan(4);
    }
  });

  it("names are unique", () => {
    const names = ROSTER.map((r) => r.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("carries no evaluative language — descriptors are neutral facts", () => {
    const banned = /\b(scandal|controversial|disgraced|accused|allege|criminal|corrupt|worst|best)\b/i;
    for (const r of ROSTER) {
      expect(banned.test(r.descriptor), `${r.name}: "${r.descriptor}"`).toBe(false);
    }
  });

  it("every category can fill a Top 10", () => {
    for (const s of CATEGORY_SLUGS) {
      expect(rosterFor(s).length).toBeGreaterThanOrEqual(10);
      expect(topTen(s)).toHaveLength(10);
    }
  });
});

describe("catalogueProfession", () => {
  it("resolves every roster entry onto the global taxonomy", () => {
    const unresolved = ROSTER.filter((r) => catalogueProfession(r) === null);
    expect(unresolved.map((r) => `${r.name} — ${r.descriptor}`)).toEqual([]);
  });

  it("returns a sector + industry + canonical label", () => {
    const p = catalogueProfession(ROSTER.find((r) => r.name === "Virat Kohli")!);
    expect(p?.label).toBe("Cricketer");
    expect(p?.sector).toBe("Sports & Athletics");
  });
});

describe("helpers", () => {
  it("figureByName is case-insensitive", () => {
    expect(figureByName("serena williams")?.category).toBe("athletes");
    expect(figureByName("  Beyoncé ")?.category).toBe("musicians");
  });

  it("relatedFigures stays in-category and excludes the person", () => {
    const related = relatedFigures("LeBron James");
    expect(related.length).toBeGreaterThan(0);
    expect(related.every((r) => r.category === "athletes")).toBe(true);
    expect(related.some((r) => r.name === "LeBron James")).toBe(false);
  });

  it("figureSlug folds accents and matches the backend slug shape", () => {
    expect(figureSlug("Beyoncé")).toBe("beyonce");
    expect(figureSlug("Lula da Silva")).toBe("lula-da-silva");
    expect(figureSlug("The Weeknd")).toBe("the-weeknd");
  });

  it("decadeOf buckets a year", () => {
    expect(decadeOf(1987)).toBe(1980);
    expect(decadeOf(2001)).toBe(2000);
  });
});
