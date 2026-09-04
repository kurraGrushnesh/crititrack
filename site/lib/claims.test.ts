import { describe, expect, test } from "vitest";
import {
  buildClaimsForControversy,
  buildClaimMatrix,
  claimsForControversy,
  filterClaims,
  titleSlug,
} from "./claims";
import type { EvidenceItem } from "./evidence";
import type { Controversy } from "./controversy";

function ev(overrides: Partial<EvidenceItem> = {}): EvidenceItem {
  return {
    evidenceId: "media-1",
    sourceUrl: "https://reuters.com/story",
    sourceName: "Reuters",
    sourceType: "news",
    title: "Star faces new allegations",
    publicationDate: "2024-03-01",
    snippet: null,
    category: "controversy",
    relatedControversies: ["New allegations"],
    relatedToSentiment: false,
    duplicateCount: 1,
    independentSourceCount: 1,
    evidenceStrength: "limited",
    strengthReason: "reported by a single publisher found so far",
    ...overrides,
  };
}

function controversy(overrides: Partial<Controversy> = {}): Controversy {
  return {
    title: "New allegations",
    summary: "Person was accused of misconduct.",
    category: "Legal",
    severity: 4,
    status: "ongoing",
    year: 2024,
    sources: ["https://reuters.com/story"],
    ...overrides,
  };
}

describe("titleSlug", () => {
  test("is stable and URL-safe", () => {
    expect(titleSlug("New allegations!")).toBe("new-allegations");
  });
});

describe("buildClaimsForControversy — base claim", () => {
  test("case 1: one allegation, no corroboration -> reported/uncorroborated, low confidence", () => {
    const claims = buildClaimsForControversy(controversy(), [ev()]);
    const base = claims.find((c) => c.claimId.endsWith("-base"))!;
    expect(base.status).toBe("reported_uncorroborated");
    expect(base.confidence).toBe("low");
    expect(base.supportingEvidenceIds).toEqual(["media-1"]);
  });

  test("case 2: multiple independent reports -> supported, high confidence", () => {
    const claims = buildClaimsForControversy(controversy(), [
      ev({ evidenceStrength: "strong", independentSourceCount: 3 }),
    ]);
    const base = claims.find((c) => c.claimId.endsWith("-base"))!;
    expect(base.status).toBe("supported");
    expect(base.confidence).toBe("high");
  });

  test("no evidence at all -> insufficient evidence, never fabricated", () => {
    const claims = buildClaimsForControversy(controversy({ sources: [] }), []);
    const base = claims.find((c) => c.claimId.endsWith("-base"))!;
    expect(base.status).toBe("insufficient_evidence");
    expect(base.supportingEvidenceIds).toEqual([]);
    expect(base.statusReason).toBe("No supporting evidence currently available.");
  });

  test("case 4: supporting + contradicting sources -> conflicting, never auto-majority", () => {
    const claims = buildClaimsForControversy(controversy(), [
      ev({ evidenceId: "media-1", evidenceStrength: "strong", independentSourceCount: 3 }),
      ev({
        evidenceId: "media-2",
        title: "Charges dropped against star",
        evidenceStrength: "moderate",
      }),
    ]);
    const base = claims.find((c) => c.claimId.endsWith("-base"))!;
    expect(base.status).toBe("conflicting");
    expect(base.confidence).toBe("medium");
    expect(base.contradictingEvidenceIds).toEqual(["media-2"]);
  });
});

describe("buildClaimsForControversy — denial/response", () => {
  test("case 5: a denial produces its own claim, distinct from the base allegation", () => {
    const claims = buildClaimsForControversy(controversy(), [
      ev({ evidenceId: "media-1" }),
      ev({
        evidenceId: "media-2",
        title: "Star denies the allegations",
        independentSourceCount: 2,
      }),
    ]);
    const denial = claims.find((c) => c.claimType === "denial")!;
    expect(denial).toBeDefined();
    expect(denial.status).toBe("supported");
    expect(denial.responseEvidenceIds).toEqual(["media-2"]);

    const base = claims.find((c) => c.claimId.endsWith("-base"))!;
    // the denial does not get counted as support for or against the
    // underlying allegation itself
    expect(base.supportingEvidenceIds).not.toContain("media-2");
    expect(base.responseEvidenceIds).toContain("media-2");
  });

  test("a lone, uncorroborated denial reads as reported, not proven", () => {
    const claims = buildClaimsForControversy(controversy(), [
      ev({ evidenceId: "media-1", title: "Star denies the allegations" }),
    ]);
    const denial = claims.find((c) => c.claimType === "denial")!;
    expect(denial.status).toBe("reported_uncorroborated");
  });
});

describe("buildClaimsForControversy — official/legal findings", () => {
  test("case 6: an investigation with no outcome never becomes a finding", () => {
    const claims = buildClaimsForControversy(controversy(), [
      ev({
        evidenceId: "media-2",
        title: "Authorities investigate allegations against star",
        independentSourceCount: 2,
      }),
    ]);
    expect(claims.find((c) => c.claimType === "legal_finding")).toBeUndefined();
    const investigation = claims.find((c) => c.claimType === "official_finding")!;
    expect(investigation.status).toBe("partially_supported");
  });

  test("case 7: a court ruling reads as a reported finding, never as CritiTrack's own verdict", () => {
    const claims = buildClaimsForControversy(controversy(), [
      ev({
        evidenceId: "media-3",
        title: "Court finds star liable, orders damages",
        sourceType: "government",
      }),
    ]);
    const finding = claims.find((c) => c.claimType === "legal_finding")!;
    expect(finding.status).toBe("resolved_authoritative");
    expect(finding.confidence).toBe("high");
    expect(finding.claimText).not.toMatch(/guilty|innocent/i);
  });

  test("a bare mention of 'court' with no resolution word stays unresolved", () => {
    const claims = buildClaimsForControversy(controversy(), [
      ev({ evidenceId: "media-3", title: "Star to appear in court next month" }),
    ]);
    const finding = claims.find((c) => c.claimType === "legal_finding")!;
    expect(finding.status).toBe("reported_uncorroborated");
  });
});

describe("case 8/9: same event vs. unrelated claims about the same person", () => {
  test("two evidence items about the same event stay one base claim", () => {
    const claims = buildClaimsForControversy(controversy(), [
      ev({ evidenceId: "media-1", publicationDate: "2024-01-01" }),
      ev({ evidenceId: "media-2", publicationDate: "2024-06-01" }),
    ]);
    expect(claims.filter((c) => c.claimId.endsWith("-base"))).toHaveLength(1);
    const base = claims.find((c) => c.claimId.endsWith("-base"))!;
    expect(base.createdAt).toBe("2024-01-01");
    expect(base.updatedAt).toBe("2024-06-01");
  });

  test("two unrelated controversies never merge into one claim", () => {
    const claims = buildClaimMatrix(
      [controversy({ title: "New allegations" }), controversy({ title: "Tax dispute" })],
      [
        ev({ evidenceId: "media-1", relatedControversies: ["New allegations"] }),
        ev({ evidenceId: "media-2", relatedControversies: ["Tax dispute"], title: "Tax dispute reported" }),
      ],
    );
    const controversyIds = new Set(claims.map((c) => c.controversyId));
    expect(controversyIds.size).toBe(2);
  });
});

describe("buildClaimMatrix / lookup / filters", () => {
  test("claimsForControversy finds only that controversy's claims", () => {
    const claims = buildClaimMatrix(
      [controversy({ title: "New allegations" }), controversy({ title: "Tax dispute", sources: [] })],
      [ev({ relatedControversies: ["New allegations"] })],
    );
    expect(claimsForControversy(claims, "Tax dispute")).toHaveLength(1);
    expect(claimsForControversy(claims, "Tax dispute")[0].status).toBe("insufficient_evidence");
  });

  test("filterClaims separates responses and official findings", () => {
    const claims = buildClaimsForControversy(controversy(), [
      ev({ evidenceId: "media-1" }),
      ev({ evidenceId: "media-2", title: "Star denies the allegations" }),
      ev({ evidenceId: "media-3", title: "Court finds star liable", sourceType: "government" }),
    ]);
    expect(filterClaims(claims, "responses")).toHaveLength(1);
    expect(filterClaims(claims, "official_findings")).toHaveLength(1);
    expect(filterClaims(claims, "all")).toHaveLength(claims.length);
  });
});

describe("CritiScore / sentiment / popularity separation", () => {
  test("claim status never reads number of claims/articles off directly as a score field", () => {
    const claims = buildClaimsForControversy(controversy(), [ev()]);
    for (const c of claims) {
      expect(c).not.toHaveProperty("critiScoreContribution");
      expect(c).not.toHaveProperty("truthScore");
    }
  });

  test("a positively-toned but uncorroborated denial is not treated as disproving the allegation", () => {
    const claims = buildClaimsForControversy(controversy(), [
      ev({ evidenceId: "media-1", sentimentTag: "negative" }),
      ev({
        evidenceId: "media-2",
        title: "Star denies the allegations",
        sentimentTag: "positive",
      }),
    ]);
    const base = claims.find((c) => c.claimId.endsWith("-base"))!;
    // sentiment tag never enters status logic directly
    expect(base.status).toBe("reported_uncorroborated");
  });
});
