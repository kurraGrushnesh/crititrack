/**
 * Verifies the newly-curated roster entries actually land in the
 * category they were added for. Every name below is checked against the
 * real taxonomy resolver (`categoriesFor` / `rosterForCategory`) — not
 * asserted by construction — so a descriptor that fails to resolve as
 * intended is caught here rather than shipped as a silent "Other
 * Notable People" fallback.
 */
import { describe, expect, it } from "vitest";
import { ROSTER, figureByName } from "./catalog";
import { rosterForCategory, categoriesFor, categoryCounts } from "./categories";

/** name → the category slug it must resolve into. */
const EXPECTED: [string, string][] = [
  ["Noam Chomsky", "academics-professors"],
  ["Steven Pinker", "academics-professors"],
  ["Malala Yousafzai", "activists-human-rights"],
  ["Amal Clooney", "lawyers-legal"],
  ["Geoffrey Hinton", "ai-machine-learning"],
  ["Fei-Fei Li", "ai-machine-learning"],
  ["Dario Amodei", "ai-machine-learning"],
  ["Bjarke Ingels", "architects"],
  ["Zaha Hadid", "architects"],
  ["Yayoi Kusama", "artists-designers"],
  ["Kehinde Wiley", "artists-designers"],
  ["Gordon Ramsay", "chefs-food"],
  ["José Andrés", "chefs-food"],
  ["Anthony Fauci", "doctors-healthcare"],
  ["Devi Shetty", "doctors-healthcare"],
  ["Paul Krugman", "economists"],
  ["Amartya Sen", "economists"],
  ["Wendy Kopp", "education"],
  ["Angela Duckworth", "education"],
  ["Burt Rutan", "engineers"],
  ["Radia Perlman", "engineers"],
  ["Jane Goodall", "environmental-climate"],
  ["David Attenborough", "environmental-climate"],
  ["Lee Sang-hyeok", "esports-gaming"],
  ["Oleksandr Kostyliev", "esports-gaming"],
  ["Bear Grylls", "explorers-adventurers"],
  ["Sylvia Earle", "explorers-adventurers"],
  ["Anna Wintour", "fashion"],
  ["Tom Ford", "fashion"],
  ["Ray Dalio", "finance-investors"],
  ["Christine Lagarde", "finance-investors"],
  ["Janet Yellen", "finance-investors"],
  ["Christiane Amanpour", "journalists-media"],
  ["Anderson Cooper", "journalists-media"],
  ["Ruth Bader Ginsburg", "lawyers-legal"],
  ["Ben Crump", "lawyers-legal"],
  ["David Petraeus", "military-defense"],
  ["Colin Powell", "military-defense"],
  ["Christopher Wray", "police-law-enforcement"],
  ["Cressida Dick", "police-law-enforcement"],
  ["Stephen Ross", "real-estate"],
  ["Barbara Corcoran", "real-estate"],
  ["Pope Francis", "religious-spiritual-leaders"],
  ["Dalai Lama", "religious-spiritual-leaders"],
  ["King Charles III", "royalty-public-figures"],
  ["Prince William", "royalty-public-figures"],
  ["Jennifer Doudna", "scientists-researchers"],
  ["Neil deGrasse Tyson", "scientists-researchers"],
  ["Scott Harrison", "social-community-leaders"],
  ["Van Jones", "social-community-leaders"],
  ["Margaret Atwood", "writers-authors"],
  ["Stephen King", "writers-authors"],
];

describe("catalogue expansion — every new entry resolves into its intended category", () => {
  for (const [name, slug] of EXPECTED) {
    it(`${name} → ${slug}`, () => {
      const entry = figureByName(name);
      expect(entry, `${name} is not in the roster`).toBeDefined();
      const members = rosterForCategory(slug, ROSTER).map((r) => r.name);
      expect(members, `${name} did not resolve into ${slug}`).toContain(name);
    });
  }

  it("every new entry lands in a real category, not just Other", () => {
    // A person may legitimately also appear under "Other Notable
    // People" (a few taxonomy occupations — monarch, explorer — sit in
    // a catch-all sector), but never *only* there.
    for (const [name, slug] of EXPECTED) {
      const entry = figureByName(name)!;
      const cats = categoriesFor(entry).map((c) => c.slug);
      expect(cats, `${name} resolved to nothing but Other`).toContain(slug);
    }
  });

  it("previously-empty categories now have real people", () => {
    const counts = categoryCounts(ROSTER);
    for (const slug of [
      "academics-professors",
      "ai-machine-learning",
      "doctors-healthcare",
      "lawyers-legal",
      "writers-authors",
      "journalists-media",
      "economists",
      "environmental-climate",
    ]) {
      expect(counts[slug], `${slug} should have real people now`).toBeGreaterThan(0);
    }
  });

  it("a person can appear under more than one category without duplicating their profile", () => {
    // Multi-category membership is real (a resolved occupation can match
    // more than one DiscoveryCategory) and every name in the roster is
    // still exactly one entry — never a second profile for a second
    // category.
    const multi = ROSTER.filter((r) => categoriesFor(r).length > 1);
    expect(multi.length).toBeGreaterThan(0);
    for (const r of ROSTER) {
      expect(
        ROSTER.filter((x) => x.name === r.name),
        `${r.name} appears more than once in the roster`,
      ).toHaveLength(1);
    }
  });

  it("no duplicate names were introduced in the expansion", () => {
    const names = ROSTER.map((r) => r.name);
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const n of names) {
      if (seen.has(n)) dupes.push(n);
      seen.add(n);
    }
    expect(dupes).toEqual([]);
  });
});
