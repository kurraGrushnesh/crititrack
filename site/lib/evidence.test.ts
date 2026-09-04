import { describe, expect, it } from "vitest";
import {
  buildEvidenceItems,
  sourceTypeFor,
  conflictingControversies,
  evidenceForControversy,
} from "./evidence";
import type { MediaLink, EvidenceFragment } from "./api";
import type { Controversy } from "./controversy";
import type { CareerEntry } from "./career";

const media = (over: Partial<MediaLink> = {}): MediaLink => ({
  id: "m1",
  title: "Star faces new allegations",
  url: "https://reuters.com/story",
  source: "Reuters",
  type: "news",
  sentimentScore: null,
  ...over,
});

const controversy = (over: Partial<Controversy> = {}): Controversy => ({
  title: "New allegations",
  summary: "Serious claims were reported against the figure.",
  category: "Legal",
  severity: 4,
  status: "ongoing",
  year: 2024,
  sources: ["https://apnews.com/report"],
  ...over,
});

const career = (over: Partial<CareerEntry> = {}): CareerEntry => ({
  start: 2018,
  end: null,
  role: "Chief Executive Officer",
  organization: "Firm C",
  location: null,
  industry: null,
  current: true,
  source: { name: "Wikidata", url: "https://www.wikidata.org/wiki/Q1" },
  ...over,
});

describe("sourceTypeFor", () => {
  it("classifies by host first", () => {
    expect(sourceTypeFor({ url: "https://en.wikipedia.org/wiki/X" })).toBe("wikipedia");
    expect(sourceTypeFor({ url: "https://www.wikidata.org/wiki/Q1" })).toBe("wikidata");
    expect(sourceTypeFor({ url: "https://web.archive.org/web/x" })).toBe("archive");
    expect(sourceTypeFor({ url: "https://sec.gov/filing" })).toBe("government");
  });

  it("falls back to the media type, then 'other'", () => {
    expect(sourceTypeFor({ url: "https://youtube.com/x", type: "youtube" })).toBe("youtube");
    expect(sourceTypeFor({ url: "https://reddit.com/x", type: "reddit" })).toBe("reddit");
    expect(sourceTypeFor({})).toBe("other");
  });
});

describe("buildEvidenceItems — media", () => {
  it("links a media item to a controversy only on real topical overlap", () => {
    const items = buildEvidenceItems({
      media: [media()],
      controversies: [controversy()],
      career: [],
      sentimentEvidence: [],
    });
    const m = items.find((i) => i.evidenceId === "media-m1")!;
    expect(m.relatedControversies).toEqual(["New allegations"]);
    expect(m.category).toBe("controversy");
  });

  it("does not invent a relationship when the topic does not overlap", () => {
    const items = buildEvidenceItems({
      media: [media({ title: "Star announces summer tour dates" })],
      controversies: [controversy()],
      career: [],
      sentimentEvidence: [],
    });
    const m = items.find((i) => i.evidenceId === "media-m1")!;
    expect(m.relatedControversies).toEqual([]);
    expect(m.category).toBe("news");
  });

  it("marks a fragment-linked item as related to sentiment", () => {
    const evidence: EvidenceFragment[] = [
      { fragment: "faces new allegations", source: "news", mediaId: "m1" },
    ];
    const items = buildEvidenceItems({
      media: [media()],
      controversies: [],
      career: [],
      sentimentEvidence: evidence,
    });
    expect(items.find((i) => i.evidenceId === "media-m1")!.relatedToSentiment).toBe(true);
  });

  it("rates strength from independent-publisher count, not raw article count", () => {
    const items = buildEvidenceItems({
      media: [
        media({ duplicateCount: 5, independentSourceCount: 1 }),
        media({ id: "m2", duplicateCount: 1, independentSourceCount: 3 }),
      ],
      controversies: [],
      career: [],
      sentimentEvidence: [],
    });
    expect(items.find((i) => i.evidenceId === "media-m1")!.evidenceStrength).toBe("limited");
    expect(items.find((i) => i.evidenceId === "media-m2")!.evidenceStrength).toBe("strong");
  });
});

describe("buildEvidenceItems — controversy sources", () => {
  it("adds a controversy's own cited source once, not duplicated with a matching media item", () => {
    const items = buildEvidenceItems({
      media: [media({ url: "https://apnews.com/report" })],
      controversies: [controversy({ sources: ["https://apnews.com/report"] })],
      career: [],
      sentimentEvidence: [],
    });
    const forThisUrl = items.filter((i) => i.sourceUrl === "https://apnews.com/report");
    expect(forThisUrl).toHaveLength(1);
  });

  it("a name-only source (no URL) is still shown, just not linkable", () => {
    const items = buildEvidenceItems({
      media: [],
      controversies: [controversy({ sources: ["Reuters"] })],
      career: [],
      sentimentEvidence: [],
    });
    const c = items.find((i) => i.category === "controversy" && i.sourceName === "Reuters")!;
    expect(c.sourceUrl).toBeNull();
    expect(c.evidenceStrength).toBe("limited");
  });
});

describe("buildEvidenceItems — career", () => {
  it("a career step with a source becomes evidence; one without is skipped", () => {
    const items = buildEvidenceItems({
      media: [],
      controversies: [],
      career: [career(), career({ source: { name: "Wikidata", url: null } })],
      sentimentEvidence: [],
    });
    expect(items.filter((i) => i.category === "career")).toHaveLength(1);
  });
});

describe("evidenceForControversy — honest absence", () => {
  it("is empty for a controversy nothing was retrieved for", () => {
    const items = buildEvidenceItems({
      media: [],
      controversies: [controversy({ sources: [] })],
      career: [],
      sentimentEvidence: [],
    });
    expect(evidenceForControversy(items, "New allegations")).toEqual([]);
  });
});

describe("conflictingControversies", () => {
  it("flags a controversy whose linked coverage disagrees in tone", () => {
    const items = buildEvidenceItems({
      media: [
        media({ id: "m1", sentimentTag: "negative" }),
        media({ id: "m2", title: "Star cleared of new allegations", sentimentTag: "positive" }),
      ],
      controversies: [controversy()],
      career: [],
      sentimentEvidence: [],
    });
    expect(conflictingControversies(items)).toEqual(["New allegations"]);
    const conflicted = items.filter((i) => i.evidenceStrength === "conflicting");
    expect(conflicted.length).toBeGreaterThan(0);
  });

  it("does not flag unanimous coverage", () => {
    const items = buildEvidenceItems({
      media: [
        media({ id: "m1", sentimentTag: "negative" }),
        media({ id: "m2", title: "Star faces new allegations again", sentimentTag: "negative" }),
      ],
      controversies: [controversy()],
      career: [],
      sentimentEvidence: [],
    });
    expect(conflictingControversies(items)).toEqual([]);
  });
});
