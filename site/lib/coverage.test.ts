import { describe, expect, test } from "vitest";
import {
  identityCoverage,
  professionalCoverage,
  careerCoverage,
  newsCoverage,
  evidenceCoverage,
  claimsCoverage,
  controversiesCoverage,
  sentimentCoverage,
  attentionCoverage,
  youtubeCoverage,
  redditCoverage,
  wikipediaCoverage,
  historicalCoverage,
  sourceDiversityCoverage,
  buildCoverageReport,
  summaryDimensions,
} from "./coverage";
import type { MediaLink, RealProfile, TrendPoint } from "./api";
import type { Controversy } from "./controversy";
import type { CareerIntelligence } from "./career";
import type { ProfessionalIdentity } from "./professional-identity";
import type { EvidenceItem } from "./evidence";
import type { Claim } from "./claims";

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

function media(overrides: Partial<MediaLink> = {}): MediaLink {
  return {
    id: "m1",
    title: "A story",
    url: "https://reuters.com/1",
    source: "Reuters",
    type: "news",
    publishedAt: "2024-01-01",
    sentimentScore: -0.4,
    sentimentTag: "negative",
    ...overrides,
  };
}

function evidence(overrides: Partial<EvidenceItem> = {}): EvidenceItem {
  return {
    evidenceId: "media-1",
    sourceUrl: "https://reuters.com/1",
    sourceName: "Reuters",
    sourceType: "news",
    title: "A story",
    publicationDate: "2024-01-01",
    snippet: null,
    category: "news",
    relatedControversies: [],
    relatedToSentiment: false,
    duplicateCount: 1,
    independentSourceCount: 1,
    evidenceStrength: "limited",
    strengthReason: "x",
    ...overrides,
  };
}

function controversy(overrides: Partial<Controversy> = {}): Controversy {
  return {
    title: "Episode",
    summary: "summary",
    category: "Legal",
    severity: 3,
    status: "ongoing",
    year: 2024,
    sources: ["https://reuters.com/1"],
    ...overrides,
  };
}

function claim(overrides: Partial<Claim> = {}): Claim {
  return {
    claimId: "episode-base",
    entityId: null,
    controversyId: "episode",
    timelineEventId: null,
    claimText: "text",
    claimType: "reported_event",
    dateContext: null,
    status: "supported",
    confidence: "high",
    supportingEvidenceIds: ["media-1"],
    contradictingEvidenceIds: [],
    neutralEvidenceIds: [],
    responseEvidenceIds: [],
    createdAt: null,
    updatedAt: null,
    methodologyVersion: "cvm-1",
    statusReason: "reason",
    ...overrides,
  };
}

describe("identityCoverage", () => {
  test("no wikidata id -> unavailable", () => {
    expect(identityCoverage(undefined, "high").level).toBe("unavailable");
  });
  test("high resolution -> high, available", () => {
    const r = identityCoverage("Q1", "high");
    expect(r.level).toBe("high");
    expect(r.status).toBe("available");
  });
  test("ambiguous resolution -> insufficient, conflicting", () => {
    const r = identityCoverage("Q1", "ambiguous");
    expect(r.level).toBe("insufficient");
    expect(r.status).toBe("conflicting");
  });
});

describe("professionalCoverage", () => {
  test("empty -> unavailable", () => {
    expect(professionalCoverage(EMPTY_PROFESSIONAL).level).toBe("unavailable");
  });
});

describe("careerCoverage", () => {
  const base: CareerIntelligence = {
    timeline: [],
    organizations: [],
    insights: { start: null, current: null, transitions: [], leadershipRoles: [], founder: false, progression: [] },
    available: false,
  };

  test("no records -> unavailable", () => {
    expect(careerCoverage(base).level).toBe("unavailable");
  });

  test("case: strong entity resolution but weak news coverage — career can still read high independently", () => {
    const c: CareerIntelligence = {
      ...base,
      available: true,
      timeline: Array.from({ length: 6 }, (_, i) => ({
        start: 2010 + i,
        end: null,
        role: "Role",
        organization: "Org",
        location: null,
        industry: null,
        current: false,
        source: { name: "Wikidata", url: "https://www.wikidata.org/wiki/Q1" },
      })),
    };
    expect(careerCoverage(c).level).toBe("high");
  });
});

describe("newsCoverage — popular person with low evidence coverage vs less-famous person with high evidence coverage", () => {
  test("case 1: a popular person with only 2 duplicate-source articles reads low/limited", () => {
    const items = [media({ id: "1", source: "TMZ" }), media({ id: "2", source: "TMZ" })];
    const r = newsCoverage(items);
    expect(r.level).toBe("low");
    expect(r.status).toBe("limited");
  });

  test("case 2: a less-famous person with many independent reports reads high", () => {
    const items = Array.from({ length: 60 }, (_, i) =>
      media({ id: `${i}`, source: `Publisher ${i % 6}` }),
    );
    const r = newsCoverage(items);
    expect(r.level).toBe("high");
    expect(r.status).toBe("available");
  });

  test("case 3: a profile with only one source stays limited even with many articles", () => {
    const items = Array.from({ length: 40 }, (_, i) => media({ id: `${i}`, source: "OnlyOutlet" }));
    const r = newsCoverage(items);
    expect(r.status).toBe("limited");
  });

  test("no news items -> unavailable, never '0'", () => {
    const r = newsCoverage([]);
    expect(r.level).toBe("unavailable");
    expect(r.reasons.join(" ")).not.toMatch(/\b0\b/);
  });
});

describe("evidenceCoverage", () => {
  test("case 4: conflicting evidence is surfaced as a conflicting status, not averaged away", () => {
    const items = [
      evidence({ evidenceId: "a", evidenceStrength: "conflicting", sentimentTag: "negative" }),
      evidence({ evidenceId: "b", evidenceStrength: "conflicting", sentimentTag: "positive" }),
    ];
    expect(evidenceCoverage(items).status).toBe("conflicting");
  });

  test("no evidence -> unavailable", () => {
    expect(evidenceCoverage([]).level).toBe("unavailable");
  });
});

describe("claimsCoverage", () => {
  test("zero controversies -> not_applicable, never a bare zero", () => {
    const r = claimsCoverage([], 0);
    expect(r.status).toBe("not_applicable");
    expect(r.reasons[0]).not.toMatch(/^0$/);
  });

  test("conflicting claims present -> conflicting status", () => {
    const r = claimsCoverage([claim({ status: "conflicting" })], 1);
    expect(r.status).toBe("conflicting");
  });
});

describe("controversiesCoverage — case 10-ish: completely unavailable / clean-record honesty", () => {
  test("zero controversies never reads as 'no controversies exist'", () => {
    const r = controversiesCoverage([]);
    expect(r.reasons[0]).toBe("No supported controversy records are currently available.");
    expect(r.reasons.join(" ")).not.toMatch(/no controversies exist/i);
  });
});

describe("sentimentCoverage — case 9: strong news but weak sentiment sample", () => {
  test("small sample with low method agreement reads low/limited even with lots of news", () => {
    const r = sentimentCoverage({ sampleSize: 4, confidence: 0.2, trend: [], media: [] });
    expect(r.level).toBe("low");
  });

  test("no sample -> unavailable", () => {
    expect(sentimentCoverage({ sampleSize: null, confidence: 0.9, trend: [], media: [] }).level).toBe(
      "unavailable",
    );
  });
});

describe("attentionCoverage", () => {
  test("no series -> unavailable", () => {
    expect(attentionCoverage(null).level).toBe("unavailable");
  });
  test("healthy series -> high", () => {
    const series = Array.from({ length: 90 }, (_, i) => ({ date: `2024-01-${(i % 28) + 1}`, views: 10 }));
    const r = attentionCoverage({ source: "wikipedia", series, summary: null });
    expect(r.level).toBe("high");
  });
});

describe("youtube / reddit coverage — provider with zero items reads unavailable, not zero", () => {
  test("youtube unavailable", () => {
    const r = youtubeCoverage([media({ type: "news" })]);
    expect(r.level).toBe("unavailable");
    expect(r.reasons[0]).not.toMatch(/\b0\b/);
  });
  test("reddit with data reads available", () => {
    const items = Array.from({ length: 6 }, (_, i) =>
      media({ id: `${i}`, type: "reddit", source: `r/sub${i % 2}` }),
    );
    expect(redditCoverage(items).status).toBe("available");
  });
});

describe("wikipediaCoverage", () => {
  test("no summary/background/image -> unavailable", () => {
    expect(wikipediaCoverage({ summary: "", background: "" }).level).toBe("unavailable");
  });
  test("summary text present -> high", () => {
    expect(wikipediaCoverage({ summary: "Bio text.", background: "" }).level).toBe("high");
  });
});

describe("historicalCoverage — case 6 & 7: no snapshots vs sparse snapshots", () => {
  test("case 6: zero snapshots -> unavailable", () => {
    expect(historicalCoverage([]).level).toBe("unavailable");
  });

  test("case 7: sparse snapshots with a real gap are flagged, never invented as continuous", () => {
    const trend: TrendPoint[] = [
      { date: "2024-01-01", score: 0.1, mentions: 5 },
      { date: "2024-06-01", score: 0.1, mentions: 5 },
      { date: "2024-06-02", score: 0.1, mentions: 5 },
    ];
    const r = historicalCoverage(trend);
    expect(r.level).toBe("low");
    expect(r.timeRange?.gapNote).toBeTruthy();
  });
});

describe("sourceDiversityCoverage", () => {
  test("case 5: provider failure — zero media and zero evidence sources -> unavailable, not 0", () => {
    const r = sourceDiversityCoverage([], []);
    expect(r.level).toBe("unavailable");
    expect(r.reasons.join(" ")).not.toMatch(/\b0\b/);
  });
});

describe("coverage vs popularity", () => {
  test("news coverage never reads a popularity/follower field — only real article/publisher counts", () => {
    const r = newsCoverage([media({ source: "A" }), media({ id: "2", source: "B" })]);
    for (const reason of r.reasons) {
      expect(reason).not.toMatch(/follower|view count|upvote|trending/i);
    }
  });
});

describe("buildCoverageReport / summaryDimensions", () => {
  function fullProfile(): RealProfile {
    return {
      slug: "jane-doe",
      name: "Jane Doe",
      verified: true,
      wikidataId: "Q1",
      profession: "Executive",
      summary: "Jane Doe is an executive.",
      background: "",
      notableWorks: [],
      fetchedAt: new Date().toISOString(),
      sentimentScore: -0.2,
      trendDirection: "down",
      explanation: "",
      confidence: 0.8,
      scoreLow: null,
      scoreHigh: null,
      sampleSize: 428,
      methodAgreement: 0.8,
      positiveRatio: 0.2,
      neutralRatio: 0.3,
      negativeRatio: 0.5,
      positiveCount: 80,
      neutralCount: 120,
      negativeCount: 228,
      scoreNews: null,
      scoreYoutube: null,
      scoreInstagram: null,
      trend: [{ date: "2024-01-01", score: -0.2, mentions: 10 }],
      evidence: [],
      controversies: [controversy()],
      media: [media()],
      attention: { source: "wikipedia", series: [{ date: "2024-01-01", views: 100 }], summary: null },
      timeline: [],
      accounts: [],
      professional: EMPTY_PROFESSIONAL,
      career: {
        timeline: [],
        organizations: [],
        insights: { start: null, current: null, transitions: [], leadershipRoles: [], founder: false, progression: [] },
        available: false,
      },
      resolution: "high",
      candidates: [],
    };
  }

  test("produces every declared dimension exactly once", () => {
    const report = buildCoverageReport({ profile: fullProfile(), evidenceItems: [], claims: [] });
    const keys = report.dimensions.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(report.coverageVersion).toBe("coverage-1");
  });

  test("summaryDimensions returns only the compact-card subset, in order", () => {
    const report = buildCoverageReport({ profile: fullProfile(), evidenceItems: [], claims: [] });
    const summary = summaryDimensions(report);
    expect(summary.map((d) => d.key)).toEqual([
      "identity",
      "career",
      "news",
      "evidence",
      "sentiment",
      "youtube",
      "historical",
    ]);
  });
});
