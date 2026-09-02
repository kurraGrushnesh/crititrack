import { describe, expect, it } from "vitest";
import { buildClassification } from "./classification";
import type { RealProfile } from "./api";

/** A profile with every field empty; individual tests fill what they need. */
function emptyProfile(over: Partial<RealProfile> = {}): RealProfile {
  return {
    slug: "x",
    name: "X",
    verified: false,
    aliases: [],
    profession: "",
    summary: "",
    background: "",
    notableWorks: [],
    fetchedAt: "2026-01-01T00:00:00Z",
    sentimentScore: 50,
    trendDirection: "stable",
    explanation: "",
    scoreLow: null,
    scoreHigh: null,
    sampleSize: null,
    methodAgreement: null,
    positiveRatio: null,
    neutralRatio: null,
    negativeRatio: null,
    positiveCount: null,
    neutralCount: null,
    negativeCount: null,
    scoreNews: null,
    scoreYoutube: null,
    scoreInstagram: null,
    trend: [],
    evidence: [],
    controversies: [],
    media: [],
    attention: null,
    facts: {
      citizenship: [],
      occupations: [],
      education: [],
      awards: [],
      notableWorks: [],
      links: {},
    },
    candidates: [],
    ...over,
  };
}

describe("buildClassification", () => {
  it("returns nothing when the profile has no source facts", () => {
    expect(buildClassification(emptyProfile())).toEqual([]);
  });

  it("emits a facet only for data that is actually present", () => {
    const facets = buildClassification(
      emptyProfile({
        facts: {
          citizenship: ["United States"],
          occupations: ["singer"],
          education: [],
          awards: [],
          notableWorks: [],
          links: {},
        },
      }),
    );
    const keys = facets.map((f) => f.key);
    expect(keys).toContain("nationality");
    expect(keys).toContain("occupations");
    expect(keys).not.toContain("education");
    expect(keys).not.toContain("awards");
  });

  it("falls back to biography.profession when entity occupations are absent", () => {
    const facets = buildClassification(
      emptyProfile({ profession: "Politician" }),
    );
    const occ = facets.find((f) => f.key === "occupations");
    expect(occ?.items.map((i) => i.label)).toEqual(["Politician"]);
  });

  it("sorts awards newest first and carries the year as meta", () => {
    const facets = buildClassification(
      emptyProfile({
        facts: {
          citizenship: [],
          occupations: [],
          education: [],
          awards: [
            { label: "Old", year: 2001 },
            { label: "New", year: 2020 },
            { label: "Undated" },
          ],
          notableWorks: [],
          links: {},
        },
      }),
    );
    const awards = facets.find((f) => f.key === "awards");
    expect(awards?.items.map((i) => i.label)).toEqual(["New", "Old", "Undated"]);
    expect(awards?.items[0].meta).toBe("2020");
  });

  it("drops link entries that are not safe https URLs", () => {
    const facets = buildClassification(
      emptyProfile({
        facts: {
          citizenship: [],
          occupations: [],
          education: [],
          awards: [],
          notableWorks: [],
          links: {
            website: "https://example.com",
            evil: "javascript:alert(1)",
          },
        },
      }),
    );
    const links = facets.find((f) => f.key === "links");
    expect(links?.items).toHaveLength(1);
    expect(links?.items[0].label).toBe("Official site");
  });

  it("groups facets under their area", () => {
    const facets = buildClassification(
      emptyProfile({ facts: { ...emptyProfile().facts, citizenship: ["Canada"] } }),
    );
    expect(facets.find((f) => f.key === "nationality")?.group).toBe("Identity");
  });
});
