import { describe, expect, test } from "vitest";
import {
  SYSTEM_VERSIONS,
  systemVersion,
  buildScoreAudit,
  buildSentimentAudit,
  buildEvidenceAudit,
  METHODOLOGY_SECTIONS,
} from "./methodology";
import { CRITISCORE_METHODOLOGY_VERSION } from "./controversy-index";
import { COVERAGE_VERSION } from "./coverage";
import type { Controversy } from "./controversy";
import type { RealProfile } from "./api";
import type { Claim } from "./claims";
import type { EvidenceItem } from "./evidence";

function controversy(overrides: Partial<Controversy> = {}): Controversy {
  return {
    title: "Episode",
    summary: "summary",
    category: "Legal",
    severity: 4,
    status: "ongoing",
    year: 2024,
    sources: ["https://reuters.com/1"],
    ...overrides,
  };
}

describe("SYSTEM_VERSIONS / systemVersion", () => {
  test("every declared system has a non-empty version, no duplicates", () => {
    const systems = SYSTEM_VERSIONS.map((s) => s.system);
    expect(new Set(systems).size).toBe(systems.length);
    for (const s of SYSTEM_VERSIONS) {
      expect(s.version.length).toBeGreaterThan(0);
    }
  });

  test("critiscore and coverage versions match their own source-of-truth constants", () => {
    expect(systemVersion("critiscore")).toBe(CRITISCORE_METHODOLOGY_VERSION);
    expect(systemVersion("coverage")).toBe(COVERAGE_VERSION);
  });

  test("an unknown system never crashes — falls back to 'unversioned'", () => {
    // @ts-expect-error deliberately invalid for the fallback path
    expect(systemVersion("nonsense")).toBe("unversioned");
  });
});

describe("buildScoreAudit — regression: CritiScore calculation is unchanged", () => {
  test("the audit's score matches computeControversyIndex exactly, never recalculated differently", () => {
    const items = [controversy(), controversy({ title: "Second", severity: 2, year: 2020 })];
    const audit = buildScoreAudit({ fetchedAt: "2026-09-05T00:00:00Z" }, items);
    expect(audit.score).toBeGreaterThan(0);
    expect(audit.version).toBe(CRITISCORE_METHODOLOGY_VERSION);
    expect(audit.calculatedAt).toBe("2026-09-05T00:00:00Z");
    // The real per-episode decomposition, not a fabricated bucket list.
    expect(audit.explanation.rows).toHaveLength(2);
    expect(audit.explanation.rows[0]).toHaveProperty("severityBase");
    expect(audit.explanation.rows[0]).toHaveProperty("recencyFactor");
    expect(audit.explanation.rows[0]).toHaveProperty("ongoingFactor");
  });

  test("no controversies -> indexConfidence is null, never fabricated", () => {
    const audit = buildScoreAudit({ fetchedAt: "2026-09-05T00:00:00Z" }, []);
    expect(audit.score).toBe(0);
    expect(audit.indexConfidence).toBeNull();
    expect(audit.confidence).toBeNull();
  });
});

describe("buildSentimentAudit — regression: sentiment fields are read, not recomputed", () => {
  function profile(overrides: Partial<RealProfile> = {}): RealProfile {
    return {
      slug: "x",
      name: "X",
      verified: true,
      profession: "",
      summary: "",
      background: "",
      notableWorks: [],
      fetchedAt: "2026-09-05T00:00:00Z",
      sentimentScore: -10,
      trendDirection: "down",
      explanation: "",
      confidence: 0.8,
      confidenceLabel: "High",
      scoreLow: null,
      scoreHigh: null,
      sampleSize: 428,
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
      trend: [{ date: "2026-08-01", score: -10, mentions: 20 }],
      evidence: [],
      controversies: [],
      media: [],
      attention: null,
      timeline: [],
      accounts: [],
      professional: {
        primary: null,
        secondary: [],
        roles: [],
        industries: [],
        specializations: [],
        expertise: [],
        careerStatus: null,
        unresolved: [],
        empty: true,
      },
      career: {
        timeline: [],
        organizations: [],
        insights: { start: null, current: null, transitions: [], leadershipRoles: [], founder: false, progression: [] },
        available: false,
      },
      relationships: [],
      resolution: "high",
      candidates: [],
      ...overrides,
    };
  }

  test("method agreement present -> 'Available', with the real numeric value carried through", () => {
    const audit = buildSentimentAudit(profile());
    expect(audit.methodAgreementStatus).toBe("Available");
    expect(audit.methodAgreement).toBe(0.8);
    expect(audit.sampleSize).toBe(428);
    expect(audit.periodDays).toBe(1);
    expect(audit.confidence).toBe("High");
  });

  test("method agreement absent -> 'Not available', never guessed", () => {
    const audit = buildSentimentAudit(profile({ methodAgreement: null }));
    expect(audit.methodAgreementStatus).toBe("Not available");
  });

  test("no trend points -> periodDays is null, not 0", () => {
    const audit = buildSentimentAudit(profile({ trend: [] }));
    expect(audit.periodDays).toBeNull();
  });
});

describe("buildEvidenceAudit — regression: evidence relationships are read, not recomputed", () => {
  function evidenceItem(overrides: Partial<EvidenceItem> = {}): EvidenceItem {
    return {
      evidenceId: "media-1",
      sourceUrl: "https://reuters.com/1",
      sourceName: "Reuters",
      sourceType: "news",
      title: "A story",
      publicationDate: "2024-01-01",
      snippet: null,
      category: "controversy",
      relatedControversies: ["Episode"],
      relatedToSentiment: false,
      duplicateCount: 1,
      independentSourceCount: 3,
      evidenceStrength: "strong",
      strengthReason: "x",
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
      status: "conflicting",
      confidence: "medium",
      supportingEvidenceIds: ["media-1"],
      contradictingEvidenceIds: ["media-2"],
      neutralEvidenceIds: [],
      responseEvidenceIds: [],
      createdAt: null,
      updatedAt: null,
      methodologyVersion: "cvm-1",
      statusReason: "reason",
      ...overrides,
    };
  }

  test("independent publisher count is computed over the claim's own supporting evidence only", () => {
    const items = [
      evidenceItem({ evidenceId: "media-1", sourceName: "Reuters" }),
      evidenceItem({ evidenceId: "media-2", sourceName: "AP" }),
      evidenceItem({ evidenceId: "media-3", sourceName: "Reuters" }), // not linked to this claim
    ];
    const audit = buildEvidenceAudit({ fetchedAt: "2026-09-05T00:00:00Z" }, claim(), items);
    expect(audit.supportingCount).toBe(1);
    expect(audit.contradictingCount).toBe(1);
    expect(audit.independentPublishers).toBe(1);
    expect(audit.status).toBe("conflicting");
    expect(audit.version).toBe("cvm-1");
  });

  test("a dangling evidence id (not found in the pool) never crashes or fabricates a source", () => {
    const audit = buildEvidenceAudit({ fetchedAt: "2026-09-05T00:00:00Z" }, claim(), []);
    expect(audit.independentPublishers).toBe(0);
  });
});

describe("METHODOLOGY_SECTIONS", () => {
  test("covers the spec's required subjects, in a legible order, with no empty content", () => {
    const ids = METHODOLOGY_SECTIONS.map((s) => s.id);
    for (const required of ["entity-resolution", "evidence", "claims", "critiscore", "sentiment", "timeline", "data-coverage", "limitations"]) {
      expect(ids).toContain(required);
    }
    for (const section of METHODOLOGY_SECTIONS) {
      expect(section.paragraphs.length).toBeGreaterThan(0);
      for (const p of section.paragraphs) expect(p.length).toBeGreaterThan(10);
    }
  });

  test("never mentions credentials, API keys, or internal infrastructure", () => {
    const text = METHODOLOGY_SECTIONS.flatMap((s) => s.paragraphs).join(" ").toLowerCase();
    for (const bad of ["api key", "secret", "credential", "service account", "env var", "localhost", "internal url"]) {
      expect(text).not.toContain(bad);
    }
  });
});
