import { beforeEach, describe, expect, it } from "vitest";
import {
  search,
  suggest,
  parseQuery,
  singularize,
  levenshtein,
  _resetIndex,
} from "./index";
import { countryFromDescriptor } from "./demonyms";

beforeEach(() => _resetIndex());

describe("helpers", () => {
  it("singularize handles regulars and irregulars", () => {
    expect(singularize("researchers")).toBe("researcher");
    expect(singularize("CEOs")).toBe("ceo");
    expect(singularize("companies")).toBe("company");
    expect(singularize("actresses")).toBe("actress");
    expect(singularize("ai")).toBe("ai");
  });
  it("levenshtein", () => {
    expect(levenshtein("zendaya", "zendaya")).toBe(0);
    expect(levenshtein("messi", "mesi")).toBe(1);
  });
  it("countryFromDescriptor reads the leading demonym", () => {
    expect(countryFromDescriptor("Portuguese footballer")).toBe("Portugal");
    expect(countryFromDescriptor("Senegalese-Italian social media personality")).toBe(
      "Senegal",
    );
    expect(countryFromDescriptor("Fabricated composite")).toBeNull();
  });
});

describe("parseQuery — natural language", () => {
  it("'AI researchers' → occupation + industry", () => {
    const p = parseQuery("AI researchers");
    expect(p.occupations.map((o) => o.id)).toContain("ai-researcher");
  });
  it("'Indian entrepreneurs' → country + occupation", () => {
    const p = parseQuery("Indian entrepreneurs");
    expect(p.country).toBe("India");
    expect(p.occupations.map((o) => o.id)).toContain("entrepreneur");
  });
  it("'technology CEOs' → sector + occupation", () => {
    const p = parseQuery("technology CEOs");
    expect(p.sectors.map((s) => s.id)).toContain("technology");
    expect(p.occupations.map((o) => o.id)).toContain("chief-executive-officer");
  });
  it("'female scientists' → notes gender is unsupported, still finds the profession", () => {
    const p = parseQuery("female scientists");
    expect(p.ignored).toContain("female");
    expect(p.occupations.length).toBeGreaterThan(0);
  });
  it("'actors' → legacy category", () => {
    expect(parseQuery("actors").legacyCategory).toBe("actors");
  });
});

describe("search — people", () => {
  it("finds an exact name", () => {
    const r = search("Elon Musk");
    expect(r.people[0]?.name).toBe("Elon Musk");
  });
  it("tolerates a partial / misspelled name", () => {
    expect(search("Cristiano Ronaldo").people[0]?.name).toBe("Cristiano Ronaldo");
    expect(search("Zendya").people.some((p) => p.name === "Zendaya")).toBe(true);
  });
  it("'football players' returns footballers", () => {
    const names = search("football players").people.map((p) => p.name);
    expect(names).toContain("Lionel Messi");
    expect(names).toContain("Cristiano Ronaldo");
    // and not, say, a musician
    expect(names).not.toContain("Beyoncé");
  });
  it("'Indian entrepreneurs' intersects country and profession", () => {
    const r = search("Indian entrepreneurs");
    expect(r.filters.country).toBe("India");
    expect(r.people.length).toBeGreaterThan(0);
    expect(r.people.every((p) => p.country === "India")).toBe(true);
  });
  it("'technology CEOs' returns tech executives", () => {
    const names = search("technology CEOs").people.map((p) => p.name);
    expect(names).toContain("Satya Nadella");
  });
  it("'YouTubers' returns online video creators", () => {
    const names = search("YouTubers").people.map((p) => p.name);
    expect(names.some((n) => ["MrBeast", "PewDiePie", "Markiplier"].includes(n))).toBe(
      true,
    );
  });
});

describe("search — grouping and honesty", () => {
  it("groups professions and categories, never invents organizations", () => {
    const r = search("cybersecurity");
    expect(r.organizations).toEqual([]);
    // cybersecurity is a real taxonomy industry even if no catalogue
    // person is in it
    expect(
      r.categories.some((c) => /cybersecurity/i.test(c.label)),
    ).toBe(true);
  });
  it("'people in cybersecurity' explains there are no catalogue people", () => {
    const r = search("people in cybersecurity");
    expect(r.people.length).toBe(0);
    expect(r.categories.length).toBeGreaterThan(0);
  });
  it("a nonsense query returns an honest empty result", () => {
    const r = search("qzxwv nonsense term");
    expect(r.people).toEqual([]);
    expect(r.professions).toEqual([]);
    expect(r.interpretation.join(" ")).toMatch(/no matching/i);
  });
});

describe("suggest — typeahead", () => {
  it("offers a direct lookup, people and professions", () => {
    const s = suggest("actor");
    expect(s[0].kind).toBe("lookup");
    expect(s.some((x) => x.kind === "occupation" && x.label === "Actor")).toBe(true);
  });
  it("suggests people by partial name", () => {
    const s = suggest("serena");
    expect(s.some((x) => x.kind === "person" && x.label === "Serena Williams")).toBe(
      true,
    );
  });
  it("returns nothing for a 1-char query", () => {
    expect(suggest("a")).toEqual([]);
  });
});
