import { describe, expect, it } from "vitest";
import { buildTimeline, sentimentShiftEvents, withinRangeDays } from "./timeline";
import type { TrendPoint, MediaLink, AttentionPoint } from "./api";
import type { Controversy } from "./controversy";
import type { CareerEntry } from "./career";

const trend = (...s: number[]): TrendPoint[] =>
  s.map((score, i) => ({ date: `2026-03-0${i + 1}`, score, mentions: 0 }));

const controversy = (over: Partial<Controversy> = {}): Controversy => ({
  title: "Tax dispute",
  summary: "A disagreement over reported income.",
  category: "Financial",
  severity: 3,
  status: "resolved",
  year: 2019,
  sources: ["https://reuters.com/story"],
  ...over,
});

const media = (over: Partial<MediaLink> = {}): MediaLink => ({
  id: "1",
  title: "Headline",
  url: "https://apnews.com/story",
  source: "AP",
  type: "news",
  sentimentScore: null,
  publishedAt: "2026-03-12T00:00:00Z",
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

const emptyInput = {
  controversies: [] as Controversy[],
  media: [] as MediaLink[],
  career: [] as CareerEntry[],
  attentionSeries: [] as AttentionPoint[],
  trend: [] as TrendPoint[],
};

describe("withinRangeDays", () => {
  const NOW = new Date("2026-03-15T00:00:00Z").getTime();

  it("null days means no limit", () => {
    expect(withinRangeDays("2010-01-01", null, NOW)).toBe(true);
  });

  it("includes a date inside the window and excludes one outside it", () => {
    expect(withinRangeDays("2026-03-01", 30, NOW)).toBe(true);
    expect(withinRangeDays("2026-01-01", 30, NOW)).toBe(false);
  });

  it("rejects an unparsable date rather than throwing", () => {
    expect(withinRangeDays("not-a-date", 30, NOW)).toBe(false);
  });
});

describe("sentimentShiftEvents", () => {
  it("emits on a jump past the threshold", () => {
    const [e] = sentimentShiftEvents(trend(50, 65));
    expect(e.change).toBe(15);
    expect(e.title).toMatch(/rose sharply/);
  });

  it("ignores a small wobble", () => {
    expect(sentimentShiftEvents(trend(50, 54, 51))).toEqual([]);
  });
});

describe("buildTimeline — controversy", () => {
  it("places a year-only controversy on Jan 1, flagged approximate", () => {
    const [e] = buildTimeline({ ...emptyInput, controversies: [controversy()] });
    expect(e.date).toBe("2019-01-01");
    expect(e.approxDate).toBe(true);
    expect(e.kind).toBe("controversy");
  });

  it("carries the episode's real sources", () => {
    const [e] = buildTimeline({ ...emptyInput, controversies: [controversy()] });
    expect(e.sources).toEqual([{ label: "reuters.com", url: "https://reuters.com/story" }]);
  });

  it("a publication-name-only source has no url", () => {
    const [e] = buildTimeline({
      ...emptyInput,
      controversies: [controversy({ sources: ["Reuters"] })],
    });
    expect(e.sources).toEqual([{ label: "Reuters", url: null }]);
  });

  it("rates importance from severity and status, not an invented score", () => {
    const [high] = buildTimeline({
      ...emptyInput,
      controversies: [controversy({ severity: 5, status: "ongoing" })],
    });
    expect(high.importance).toBe("high");
    expect(high.importanceReason).toMatch(/severity 5\/5/);

    const [low] = buildTimeline({
      ...emptyInput,
      controversies: [controversy({ severity: 1, status: "historical" })],
    });
    expect(low.importance).toBe("low");
  });

  it("drops a controversy with no recorded year", () => {
    expect(
      buildTimeline({ ...emptyInput, controversies: [controversy({ year: undefined })] }),
    ).toEqual([]);
  });
});

describe("buildTimeline — career and organization", () => {
  it("a role entry becomes a career event", () => {
    const [e] = buildTimeline({ ...emptyInput, career: [career()] });
    expect(e.kind).toBe("career");
    expect(e.title).toBe("Chief Executive Officer, Firm C");
    expect(e.date).toBe("2018-01-01");
  });

  it("a role-less employer entry becomes an organization event", () => {
    const [e] = buildTimeline({
      ...emptyInput,
      career: [career({ role: null, organization: "Sidley Austin", start: 1991 })],
    });
    expect(e.kind).toBe("organization");
    expect(e.title).toBe("Sidley Austin");
  });

  it("a leadership title is rated high importance", () => {
    const [e] = buildTimeline({
      ...emptyInput,
      career: [career({ role: "Chief Executive Officer" })],
    });
    expect(e.importance).toBe("high");
  });

  it("an undated career row is dropped", () => {
    expect(
      buildTimeline({ ...emptyInput, career: [career({ start: null })] }),
    ).toEqual([]);
  });
});

describe("buildTimeline — news grouping", () => {
  it("a single article on its own is not a timeline event", () => {
    expect(
      buildTimeline({ ...emptyInput, media: [media()] }),
    ).toEqual([]);
  });

  it("two or more sources the same day become one grouped event", () => {
    const [e] = buildTimeline({
      ...emptyInput,
      media: [
        media({ id: "1", url: "https://a.example/1" }),
        media({ id: "2", url: "https://b.example/2", source: "Reuters" }),
      ],
    });
    expect(e.kind).toBe("news");
    expect(e.sourceCount).toBe(2);
    expect(e.date).toBe("2026-03-12");
    expect(e.sources).toHaveLength(2);
  });

  it("averages the grouped items' sentiment, ignoring unscored ones", () => {
    const [e] = buildTimeline({
      ...emptyInput,
      media: [
        media({ id: "1", url: "https://a.example/1", sentimentScore: 80 }),
        media({ id: "2", url: "https://b.example/2", sentimentScore: 60 }),
        media({ id: "3", url: "https://c.example/3", sentimentScore: null }),
      ],
    });
    expect(e.sentimentImpact).toBe(70);
  });

  it("does not double-count the same url twice in the source list", () => {
    const [e] = buildTimeline({
      ...emptyInput,
      media: [
        media({ id: "1", url: "https://a.example/1" }),
        media({ id: "2", url: "https://a.example/1" }),
        media({ id: "3", url: "https://b.example/3" }),
      ],
    });
    expect(e.sourceCount).toBe(3);
    expect(e.sources).toHaveLength(2);
  });

  it("undated media (no publishedAt) never becomes an event", () => {
    expect(
      buildTimeline({
        ...emptyInput,
        media: [
          media({ id: "1", publishedAt: undefined }),
          media({ id: "2", publishedAt: undefined }),
        ],
      }),
    ).toEqual([]);
  });
});

describe("buildTimeline — attention and sentiment (existing behaviour preserved)", () => {
  const spikeSeries = (): AttentionPoint[] => [
    { date: "2026-01-01", views: 100 },
    { date: "2026-01-02", views: 110 },
    { date: "2026-01-03", views: 105 },
    { date: "2026-01-04", views: 95 },
    { date: "2026-01-05", views: 100 },
    { date: "2026-01-06", views: 5000 },
  ];

  it("flags a genuine spike day and carries the raw view count", () => {
    const out = buildTimeline({ ...emptyInput, attentionSeries: spikeSeries() });
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("attention-spike");
    expect(out[0].attentionImpact).toBe(5000);
  });

  it("a sentiment shift still appears and carries its delta", () => {
    const out = buildTimeline({ ...emptyInput, trend: trend(50, 50, 70) });
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("sentiment-shift");
    expect(out[0].change).toBe(20);
  });
});

describe("buildTimeline — merge order and relationships", () => {
  it("merges every kind, newest first", () => {
    const out = buildTimeline({
      controversies: [controversy({ year: 2020 })],
      media: [
        media({ id: "1", url: "https://a.example/1", publishedAt: "2026-03-02T00:00:00Z" }),
        media({ id: "2", url: "https://b.example/2", publishedAt: "2026-03-02T00:00:00Z" }),
      ],
      career: [career({ start: 2015 })],
      attentionSeries: [],
      trend: trend(50, 50, 70),
    });
    const kinds = out.map((e) => e.kind);
    expect(kinds).toContain("sentiment-shift");
    expect(kinds).toContain("news");
    expect(kinds).toContain("career");
    expect(kinds).toContain("controversy");
    // Newest first.
    expect(out[0].date >= out[out.length - 1].date).toBe(true);
  });

  it("tags nearby events as related without claiming a cause", () => {
    const out = buildTimeline({
      ...emptyInput,
      controversies: [controversy({ year: 2026 })],
      trend: [
        { date: "2026-01-01", score: 50, mentions: 0 },
        { date: "2026-01-03", score: 20, mentions: 0 },
      ],
    });
    const sentiment = out.find((e) => e.kind === "sentiment-shift")!;
    expect(sentiment.relatedTitles).toContain("Tax dispute");
  });

  it("is empty when there is nothing dated at all", () => {
    expect(buildTimeline(emptyInput)).toEqual([]);
  });
});

describe("buildTimeline — Step 16 Change Detection integration", () => {
  const change = (over: Partial<import("./changes").ChangeEvent> = {}): import("./changes").ChangeEvent => ({
    changeId: "c1",
    entityId: "x",
    changeType: "CRITISCORE_CHANGE",
    severity: "MAJOR",
    title: "CritiScore increased +13",
    summary: "reason",
    previousValue: "48",
    currentValue: "61",
    detectedAt: "2026-09-05T00:00:00Z",
    effectiveDate: null,
    evidenceIds: [],
    relatedClaimIds: [],
    methodologyVersion: "2.0",
    confidence: "HIGH",
    sourceCoverage: null,
    ...over,
  });

  it("folds a CritiScore/claim/coverage/profile change in as its own 'change' event", () => {
    const out = buildTimeline({ ...emptyInput, changeEvents: [change()] });
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("change");
    expect(out[0].title).toBe("CritiScore increased +13");
    expect(out[0].importance).toBe("high");
  });

  it("never duplicates a controversy/career/news/sentiment change already derivable from the same data", () => {
    const out = buildTimeline({
      ...emptyInput,
      controversies: [controversy({ year: 2026 })],
      changeEvents: [
        change({ changeType: "CONTROVERSY_CHANGE", title: "New supported controversy: Tax dispute" }),
      ],
    });
    // Only the controversy's own timeline entry — the duplicate-shaped
    // CONTROVERSY_CHANGE is not one of the folded-in types.
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("controversy");
  });

  it("with no changeEvents supplied, behaves exactly as before Step 16", () => {
    const out = buildTimeline({ ...emptyInput, controversies: [controversy({ year: 2026 })] });
    expect(out).toHaveLength(1);
    expect(out.every((e) => e.kind !== "change")).toBe(true);
  });

  it("uses the change's effectiveDate when known, else falls back to detectedAt", () => {
    const withDate = buildTimeline({
      ...emptyInput,
      changeEvents: [change({ effectiveDate: "2020" })],
    });
    expect(withDate[0].date).toBe("2020");
    expect(withDate[0].approxDate).toBe(false);

    const withoutDate = buildTimeline({ ...emptyInput, changeEvents: [change({ effectiveDate: null })] });
    expect(withoutDate[0].date).toBe("2026-09-05");
    expect(withoutDate[0].approxDate).toBe(true);
  });
});
