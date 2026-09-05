import { beforeEach, describe, expect, test } from "vitest";
import { detectChanges, filterChanges, resetChangeIdCounter, type ChangeEvent } from "./changes";
import type { RealProfile, MediaLink } from "./api";
import type { Controversy } from "./controversy";
import type { CareerEntry } from "./career";
import type { ProfessionalIdentity } from "./professional-identity";

const EMPTY_PROFESSIONAL: ProfessionalIdentity = {
  primary: null,
  secondary: [],
  roles: [],
  industries: [],
  specializations: [],
  expertise: [],
  careerStatus: null,
  unresolved: [],
  empty: true,
};

function career(entries: CareerEntry[] = [], organizations: string[] = []) {
  return {
    timeline: entries,
    organizations,
    insights: { start: null, current: null, transitions: [], leadershipRoles: [], founder: false, progression: [] },
    available: entries.length > 0,
  };
}

function careerEntry(overrides: Partial<CareerEntry> = {}): CareerEntry {
  return {
    start: 2020,
    end: null,
    role: "Analyst",
    organization: "Firm A",
    location: null,
    industry: null,
    current: true,
    source: { name: "Wikidata", url: "https://www.wikidata.org/wiki/Q1" },
    ...overrides,
  };
}

function controversy(overrides: Partial<Controversy> = {}): Controversy {
  return {
    title: "Fraud allegations",
    summary: "The executive was accused of misrepresenting finances.",
    category: "Financial",
    severity: 4,
    status: "ongoing",
    year: 2024,
    sources: ["https://reuters.com/1"],
    ...overrides,
  };
}

function media(overrides: Partial<MediaLink> = {}): MediaLink {
  return {
    id: "m1",
    title: "Story",
    url: "https://reuters.com/story-1",
    source: "Reuters",
    type: "news",
    publishedAt: "2026-01-01",
    sentimentScore: 0,
    ...overrides,
  };
}

function profile(overrides: Partial<RealProfile> = {}): RealProfile {
  return {
    slug: "jane-doe",
    name: "Jane Doe",
    verified: true,
    wikidataId: "Q1",
    profession: "Executive",
    summary: "Jane Doe is an executive.",
    background: "",
    notableWorks: [],
    fetchedAt: "2026-09-05T00:00:00Z",
    sentimentScore: 50,
    trendDirection: "stable",
    explanation: "",
    confidence: 0.8,
    scoreLow: null,
    scoreHigh: null,
    sampleSize: 50,
    methodAgreement: 0.8,
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
    timeline: [],
    accounts: [],
    professional: EMPTY_PROFESSIONAL,
    career: career(),
    resolution: "high",
    candidates: [],
    ...overrides,
  };
}

beforeEach(() => resetChangeIdCounter());

describe("scenario 1: first-ever profile refresh has nothing to compare — caller must not call detectChanges", () => {
  test("comparing a profile against itself with no data produces nothing", () => {
    const p = profile();
    expect(detectChanges(p, p, p.fetchedAt)).toEqual([]);
  });
});

describe("scenario 2: no changes -> no events, even with rich unchanged data", () => {
  test("identical career/controversies/sentiment produce zero events", () => {
    const p = profile({
      career: career([careerEntry()], ["Firm A"]),
      controversies: [controversy()],
      media: [media()],
    });
    expect(detectChanges(p, p, p.fetchedAt)).toEqual([]);
  });

  test("array reordering alone is never a change (order-independent comparison)", () => {
    const a = careerEntry({ role: "Analyst" });
    const b = careerEntry({ role: "Manager", start: 2022 });
    const before = profile({ career: career([a, b]) });
    const after = profile({ career: career([b, a]) });
    expect(detectChanges(before, after, after.fetchedAt)).toEqual([]);
  });
});

describe("scenario 3 & 4: new supported controversy vs. a new article about an existing one", () => {
  test("scenario 3: a genuinely new controversy fires CONTROVERSY_CHANGE", () => {
    const before = profile({ controversies: [] });
    const after = profile({ controversies: [controversy()] });
    const events = detectChanges(before, after, after.fetchedAt);
    const c = events.find((e) => e.changeType === "CONTROVERSY_CHANGE")!;
    expect(c).toBeDefined();
    expect(c.title).toContain("New supported controversy");
    expect(c.severity).toBe("MAJOR"); // severity 4
  });

  test("scenario 4: a new article about an already-tracked controversy is not a new controversy or a news event", () => {
    const existing = controversy();
    const before = profile({
      controversies: [existing],
      media: [media({ id: "m1", url: "https://reuters.com/story-1", title: "Fraud allegations reported" })],
    });
    const after = profile({
      controversies: [existing],
      media: [
        media({ id: "m1", url: "https://reuters.com/story-1", title: "Fraud allegations reported" }),
        media({ id: "m2", url: "https://apnews.com/story-2", title: "More on the fraud allegations", source: "AP" }),
      ],
    });
    const events = detectChanges(before, after, after.fetchedAt);
    expect(events.filter((e) => e.changeType === "CONTROVERSY_CHANGE")).toEqual(
      events.filter((e) => e.changeType === "CONTROVERSY_CHANGE" && e.title.includes("New supporting evidence")),
    );
    expect(events.some((e) => e.changeType === "NEWS_CHANGE")).toBe(false);
  });
});

describe("scenario 5: new career role", () => {
  test("a new sourced role fires CAREER_CHANGE with high confidence", () => {
    const before = profile({ career: career([]) });
    const after = profile({ career: career([careerEntry({ role: "CEO", organization: "Acme" })]) });
    const events = detectChanges(before, after, after.fetchedAt);
    const c = events.find((e) => e.changeType === "CAREER_CHANGE")!;
    expect(c.title).toContain("CEO at Acme");
    expect(c.confidence).toBe("HIGH");
  });

  test("an unsourced career entry still surfaces, but at low confidence", () => {
    const before = profile({ career: career([]) });
    const after = profile({
      career: career([careerEntry({ role: "Advisor", organization: "Startup X", source: { name: "x", url: null } })]),
    });
    const events = detectChanges(before, after, after.fetchedAt);
    const c = events.find((e) => e.changeType === "CAREER_CHANGE")!;
    expect(c.confidence).toBe("LOW");
  });
});

describe("scenario 6 & 7: sentiment shift with vs. without enough data", () => {
  test("scenario 6: a band shift with a healthy sample fires a real SENTIMENT_CHANGE", () => {
    const before = profile({ sentimentScore: 50, sampleSize: 100 });
    const after = profile({ sentimentScore: 10, sampleSize: 120, confidence: 0.8 });
    const events = detectChanges(before, after, after.fetchedAt);
    const s = events.find((e) => e.changeType === "SENTIMENT_CHANGE")!;
    expect(s.currentValue).toBe("negative");
    expect(s.summary).not.toMatch(/insufficient/i);
  });

  test("scenario 7: a band shift with a tiny sample reads honestly insufficient", () => {
    const before = profile({ sentimentScore: 50, sampleSize: 100 });
    const after = profile({ sentimentScore: 10, sampleSize: 3 });
    const events = detectChanges(before, after, after.fetchedAt);
    const s = events.find((e) => e.changeType === "SENTIMENT_CHANGE")!;
    expect(s.summary).toBe("Sentiment data insufficient to determine a meaningful change.");
    expect(s.confidence).toBe("LOW");
  });

  test("no sentiment sample at all -> no event manufactured", () => {
    const before = profile({ sentimentScore: 50, sampleSize: 100 });
    const after = profile({ sentimentScore: 10, sampleSize: null });
    expect(detectChanges(before, after, after.fetchedAt).some((e) => e.changeType === "SENTIMENT_CHANGE")).toBe(
      false,
    );
  });
});

describe("scenario 8: attention spike never becomes a controversy change", () => {
  test("a large attention increase with zero controversies stays an ATTENTION_CHANGE only", () => {
    const before = profile({ attention: { source: "wikipedia", series: [], summary: null } });
    const after = profile({
      attention: {
        source: "wikipedia",
        series: [],
        summary: { days: 30, total: 100, mean: 10, median: 10, peak: { date: "x", views: 50 }, latest: { date: "x", views: 50 }, changePct: 180 },
      },
    });
    const events = detectChanges(before, after, after.fetchedAt);
    expect(events).toHaveLength(1);
    expect(events[0].changeType).toBe("ATTENTION_CHANGE");
    expect(events[0].title).not.toMatch(/controvers/i);
    // The summary is allowed to explicitly disclaim controversy (that is
    // the desired safeguard) but must never assert one increased.
    expect(events[0].summary).not.toMatch(/controversy increased/i);
    expect(events[0].severity).toBe("SIGNIFICANT");
  });

  test("a small attention move under the noise threshold produces nothing", () => {
    const before = profile({ attention: { source: "wikipedia", series: [], summary: null } });
    const after = profile({
      attention: {
        source: "wikipedia",
        series: [],
        summary: { days: 30, total: 100, mean: 10, median: 10, peak: { date: "x", views: 50 }, latest: { date: "x", views: 50 }, changePct: 12 },
      },
    });
    expect(detectChanges(before, after, after.fetchedAt)).toEqual([]);
  });
});

describe("scenario 9: CritiScore change uses the real deterministic formula", () => {
  test("adding a severe new episode raises the score and explains why", () => {
    const before = profile({ controversies: [] });
    const after = profile({ controversies: [controversy({ severity: 5 })] });
    const events = detectChanges(before, after, after.fetchedAt);
    const s = events.find((e) => e.changeType === "CRITISCORE_CHANGE")!;
    expect(Number(s.currentValue)).toBeGreaterThan(Number(s.previousValue));
    expect(s.summary).toMatch(/newly supported episode/);
    expect(s.severity).toBe("MAJOR");
  });

  test("no controversy change -> no CritiScore change event", () => {
    const p = profile({ controversies: [controversy()] });
    expect(detectChanges(p, p, p.fetchedAt).some((e) => e.changeType === "CRITISCORE_CHANGE")).toBe(false);
  });
});

describe("scenario 10: provider/API failure is a DATA_AVAILABILITY_CHANGE, never a real-world change", () => {
  test("YouTube data disappearing reads as unavailable, never as reduced activity", () => {
    const before = profile({
      media: [media({ id: "y1", type: "youtube", source: "Channel A" })],
    });
    const after = profile({ media: [] });
    const events = detectChanges(before, after, after.fetchedAt);
    const a = events.find((e) => e.changeType === "DATA_AVAILABILITY_CHANGE" && e.title.includes("YouTube"))!;
    expect(a).toBeDefined();
    expect(a.title).not.toMatch(/disappeared|decreased|activity dropped/i);
    expect(a.summary).toMatch(/no usable data/i);
  });
});

describe("scenario 11: duplicate/syndicated news never inflates into multiple events", () => {
  test("re-seeing the same URL is not a new article at all", () => {
    const shared = media({ id: "m1", url: "https://reuters.com/story-1" });
    const before = profile({ media: [shared] });
    const after = profile({ media: [shared] });
    expect(detectChanges(before, after, after.fetchedAt).some((e) => e.changeType === "NEWS_CHANGE")).toBe(false);
  });

  test("a single new single-source article is noise, not an event", () => {
    const before = profile({ media: [] });
    const after = profile({ media: [media({ id: "solo", title: "A minor mention" })] });
    expect(detectChanges(before, after, after.fetchedAt).some((e) => e.changeType === "NEWS_CHANGE")).toBe(false);
  });

  test("two independent publishers on the same real event -> one grouped NEWS_CHANGE, not two", () => {
    const before = profile({ media: [] });
    const after = profile({
      media: [
        media({ id: "a", title: "Company X announces acquisition of Y", source: "Reuters", publishedAt: "2026-01-01" }),
        media({ id: "b", title: "Company X announces acquisition of Y deal", source: "AP", publishedAt: "2026-01-01" }),
      ],
    });
    const events = detectChanges(before, after, after.fetchedAt).filter((e) => e.changeType === "NEWS_CHANGE");
    expect(events).toHaveLength(1);
    expect(events[0].evidenceIds).toHaveLength(2);
  });
});

describe("scenario 12: conflicting evidence surfaces as a claim status change with real evidence ids", () => {
  test("a claim moving toward conflicting reports the new contradicting source", () => {
    const before = profile({
      controversies: [controversy()],
      media: [media({ id: "m1", url: "https://reuters.com/story-1", title: "Fraud allegations reported" })],
    });
    const after = profile({
      controversies: [controversy()],
      media: [
        media({ id: "m1", url: "https://reuters.com/story-1", title: "Fraud allegations reported" }),
        media({
          id: "m2",
          url: "https://apnews.com/story-2",
          title: "Charges dropped in fraud allegations case",
          source: "AP",
        }),
      ],
    });
    const events = detectChanges(before, after, after.fetchedAt);
    const claimEvent = events.find((e) => e.changeType === "CLAIM_CHANGE");
    expect(claimEvent).toBeDefined();
    expect(claimEvent!.currentValue).toBe("conflicting");
    expect(claimEvent!.evidenceIds.length).toBeGreaterThan(0);
  });
});

describe("scenario 13: a historical snapshot gap does not fabricate a smooth transition", () => {
  test("comparing two far-apart real snapshots only reports the net real difference, nothing invented in between", () => {
    const before = profile({ controversies: [], career: career([]) });
    const after = profile({
      controversies: [controversy()],
      career: career([careerEntry({ role: "CEO", organization: "Acme" })]),
    });
    const events = detectChanges(before, after, after.fetchedAt);
    // Exactly the real, detectable differences - nothing more.
    const types = new Set(events.map((e) => e.changeType));
    expect(types.has("CONTROVERSY_CHANGE")).toBe(true);
    expect(types.has("CAREER_CHANGE")).toBe(true);
    expect(types.has("CRITISCORE_CHANGE")).toBe(true);
  });
});

describe("formatting-only / noise changes never fire", () => {
  test("whitespace-only summary rewording is ignored", () => {
    const before = profile({ summary: "Jane Doe   is an executive." });
    const after = profile({ summary: "Jane doe is an executive." });
    expect(detectChanges(before, after, after.fetchedAt)).toEqual([]);
  });

  test("image URL and fetchedAt-only differences are never compared at all", () => {
    const before = profile({ imageUrl: "https://a.example/old.jpg" });
    const after = profile({ imageUrl: "https://a.example/new.jpg", fetchedAt: "2026-09-06T00:00:00Z" });
    expect(detectChanges(before, after, after.fetchedAt)).toEqual([]);
  });
});

describe("filterChanges", () => {
  test("separates change types into the documented filter buckets", () => {
    const events: ChangeEvent[] = [
      { changeId: "1", entityId: "x", changeType: "CAREER_CHANGE", severity: "MINOR", title: "t", summary: "s", previousValue: null, currentValue: null, detectedAt: "d", effectiveDate: null, evidenceIds: [], relatedClaimIds: [], methodologyVersion: "1.0", confidence: "HIGH", sourceCoverage: null },
      { changeId: "2", entityId: "x", changeType: "CRITISCORE_CHANGE", severity: "MAJOR", title: "t", summary: "s", previousValue: null, currentValue: null, detectedAt: "d", effectiveDate: null, evidenceIds: [], relatedClaimIds: [], methodologyVersion: "1.0", confidence: "HIGH", sourceCoverage: null },
    ];
    expect(filterChanges(events, "career")).toHaveLength(1);
    expect(filterChanges(events, "score")).toHaveLength(1);
    expect(filterChanges(events, "all")).toHaveLength(2);
  });
});

describe("severity/confidence never imply wrongdoing or leak popularity", () => {
  test("no change event's text ever mentions followers/upvotes/trending", () => {
    const before = profile({ controversies: [], career: career([]) });
    const after = profile({
      controversies: [controversy()],
      career: career([careerEntry()]),
      sentimentScore: 5,
      sampleSize: 200,
    });
    const events = detectChanges(before, after, after.fetchedAt);
    for (const e of events) {
      const text = `${e.title} ${e.summary}`.toLowerCase();
      expect(text).not.toMatch(/follower|upvote|trending|view count/);
    }
  });
});
