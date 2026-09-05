import { beforeEach, describe, expect, test } from "vitest";
import {
  buildRelationships,
  filterRelationships,
  searchRelationships,
  relationshipCoverage,
  directRelationshipsBetween,
  sharedConnections,
  relationshipChanges,
  defaultRelationshipFilters,
  resetRelationshipIdCounter,
  categoryOf,
  type EntityRelationship,
} from "./relationships";
import type { RawRelationship } from "./api";
import type { CareerEntry } from "./career";
import type { EvidenceItem } from "./evidence";

function raw(overrides: Partial<RawRelationship> = {}): RawRelationship {
  return {
    type: "SPOUSE",
    category: "PERSONAL",
    direction: "BIDIRECTIONAL",
    targetId: "Q100",
    targetLabel: "Alex Roe",
    start: 2015,
    end: null,
    sourceUrl: "https://www.wikidata.org/wiki/Q1",
    ...overrides,
  };
}

function careerEntry(overrides: Partial<CareerEntry> = {}): CareerEntry {
  return {
    start: 2019,
    end: null,
    role: "Chief Executive Officer",
    organization: "Acme Corp",
    location: null,
    industry: null,
    current: true,
    source: { name: "Wikidata", url: "https://www.wikidata.org/wiki/Q1" },
    ...overrides,
  };
}

function evidence(overrides: Partial<EvidenceItem> = {}): EvidenceItem {
  return {
    evidenceId: "e1",
    sourceUrl: "https://reuters.com/1",
    sourceName: "Reuters",
    sourceType: "news",
    title: "Story",
    publicationDate: "2024-01-01",
    snippet: null,
    category: "news",
    relatedControversies: [],
    relatedToSentiment: false,
    duplicateCount: null,
    independentSourceCount: null,
    evidenceStrength: "moderate",
    strengthReason: "",
    ...overrides,
  } as EvidenceItem;
}

beforeEach(resetRelationshipIdCounter);

describe("buildRelationships — evidence requirement", () => {
  test("a structured Wikidata relationship with a source is surfaced; one without a source is not", () => {
    const withSource = raw({ sourceUrl: "https://www.wikidata.org/wiki/Q1" });
    const noSource = raw({ targetId: "Q200", targetLabel: "No Source Person", sourceUrl: null });
    const rels = buildRelationships({
      subjectEntityId: "Q1",
      subjectName: "Jane Doe",
      wikidataRelationships: [withSource, noSource],
      career: [],
      evidenceItems: [],
    });
    expect(rels).toHaveLength(1);
    expect(rels[0].objectName).toBe("Alex Roe");
  });

  test("no relationship is ever created from co-occurrence alone — evidence text is only corroboration", () => {
    // Two people named in the same article, but NO structured record.
    const rels = buildRelationships({
      subjectEntityId: "Q1",
      subjectName: "Jane Doe",
      wikidataRelationships: [],
      career: [],
      evidenceItems: [evidence({ title: "Jane Doe and John Roe seen at an event" })],
    });
    expect(rels).toEqual([]);
  });
});

describe("buildRelationships — types, direction, status, dates", () => {
  test("family relationships get the PERSONAL category and a person object kind", () => {
    const rels = buildRelationships({
      subjectEntityId: "Q1",
      subjectName: "Jane Doe",
      wikidataRelationships: [raw({ type: "SIBLING", targetLabel: "Sam Doe" })],
      career: [],
      evidenceItems: [],
    });
    expect(rels[0].category).toBe("PERSONAL");
    expect(rels[0].objectKind).toBe("person");
    expect(rels[0].direction).toBe("BIDIRECTIONAL");
  });

  test("a career row's own role text maps to a professional relationship type", () => {
    const rels = buildRelationships({
      subjectEntityId: "Q1",
      subjectName: "Jane Doe",
      wikidataRelationships: [],
      career: [
        careerEntry({ role: "Founder", organization: "Startup Inc", start: 2010, end: 2015 }),
        careerEntry({ role: "Chief Executive Officer", organization: "Acme Corp", start: 2016 }),
        careerEntry({ role: "Software Engineer", organization: "BigCo", start: 2005, end: 2008 }),
      ],
      evidenceItems: [],
    });
    const byType = Object.fromEntries(rels.map((r) => [r.objectName, r.relationshipType]));
    expect(byType["Startup Inc"]).toBe("FOUNDED");
    expect(byType["Acme Corp"]).toBe("LEADS");
    expect(byType["BigCo"]).toBe("EMPLOYED_BY");
  });

  test("an ended career row is HISTORICAL/ENDED; an open-ended one is ACTIVE", () => {
    const rels = buildRelationships({
      subjectEntityId: "Q1",
      subjectName: "Jane Doe",
      wikidataRelationships: [],
      career: [
        careerEntry({ organization: "Old Co", start: 2010, end: 2015 }),
        careerEntry({ organization: "New Co", start: 2016, end: null }),
      ],
      evidenceItems: [],
    });
    expect(rels.find((r) => r.objectName === "Old Co")?.status).toBe("ENDED");
    expect(rels.find((r) => r.objectName === "New Co")?.status).toBe("ACTIVE");
  });
});

describe("buildRelationships — deduplication", () => {
  test("two career rows for the same org/role/start collapse to one relationship, merging their sources", () => {
    const rels = buildRelationships({
      subjectEntityId: "Q1",
      subjectName: "Jane Doe",
      wikidataRelationships: [],
      career: [
        careerEntry({ role: "Chief Executive Officer", organization: "Acme Corp", start: 2016, end: null, source: { name: "Wikidata", url: "https://www.wikidata.org/wiki/Q1#P39" } }),
        careerEntry({ role: "Chief Executive Officer", organization: "Acme Corp", start: 2016, end: null, source: { name: "Wikidata", url: "https://www.wikidata.org/wiki/Q1#P108" } }),
      ],
      evidenceItems: [],
    });
    const acme = rels.filter((r) => r.objectName === "Acme Corp");
    expect(acme).toHaveLength(1);
    expect(acme[0].sourceUrls).toHaveLength(2);
  });

  test("a later record adding an end date closes an open relationship rather than adding a second row", () => {
    const rels = buildRelationships({
      subjectEntityId: "Q1",
      subjectName: "Jane Doe",
      wikidataRelationships: [],
      career: [
        careerEntry({ role: "Analyst", organization: "Firm X", start: 2018, end: null }),
        careerEntry({ role: "Analyst", organization: "Firm X", start: 2018, end: 2022 }),
      ],
      evidenceItems: [],
    });
    const firmX = rels.filter((r) => r.objectName === "Firm X");
    expect(firmX).toHaveLength(1);
    expect(firmX[0].status).toBe("ENDED");
    expect(firmX[0].effectiveTo).toBe(2022);
  });
});

describe("filter / search / coverage", () => {
  const list: EntityRelationship[] = [
    buildRelationships({
      subjectEntityId: "Q1",
      subjectName: "Jane Doe",
      wikidataRelationships: [raw({ type: "SPOUSE", targetLabel: "Alex Roe" })],
      career: [careerEntry({ organization: "Acme Corp", start: 2016 }), careerEntry({ organization: "Old Co", start: 2005, end: 2009 })],
      evidenceItems: [],
    }),
  ].flat();

  test("category filter narrows to one category", () => {
    const filters = { ...defaultRelationshipFilters(), category: "PERSONAL" as const };
    const out = filterRelationships(list, filters);
    expect(out.every((r) => r.category === "PERSONAL")).toBe(true);
  });

  test("'current' time filter drops ended relationships", () => {
    const filters = { ...defaultRelationshipFilters(), time: "current" as const };
    const out = filterRelationships(list, filters);
    expect(out.every((r) => r.status !== "ENDED")).toBe(true);
  });

  test("search matches the related entity name and the relationship type label", () => {
    expect(searchRelationships(list, "acme")).toHaveLength(1);
    expect(searchRelationships(list, "spouse")).toHaveLength(1);
  });

  test("coverage counts confidence bands and distinct supporting sources without a trust score", () => {
    const cov = relationshipCoverage(list);
    expect(cov.total).toBe(list.length);
    expect(cov.high + cov.medium + cov.low).toBe(list.length);
    expect(cov).not.toHaveProperty("trustScore");
  });
});

describe("Advanced Compare helpers", () => {
  const aRels = buildRelationships({
    subjectEntityId: "QA",
    subjectName: "Person A",
    wikidataRelationships: [raw({ type: "MEMBER_OF", targetId: "org:the-institute", targetLabel: "The Institute" })],
    career: [careerEntry({ role: "Founder", organization: "Shared Org", start: 2010 })],
    evidenceItems: [],
  });
  const bRels = buildRelationships({
    subjectEntityId: "QB",
    subjectName: "Person B",
    wikidataRelationships: [],
    career: [careerEntry({ role: "Board member", organization: "Shared Org", start: 2018 })],
    evidenceItems: [],
  });

  test("a shared organization is reported as a shared connection, never a direct relationship", () => {
    const shared = sharedConnections(aRels, bRels);
    expect(shared).toHaveLength(1);
    expect(shared[0].organizationName).toBe("Shared Org");
    expect(shared[0].aType).toBe("FOUNDED");
    expect(shared[0].bType).toBe("BOARD_MEMBER_OF");
  });

  test("no direct relationship between A and B when none is documented", () => {
    expect(directRelationshipsBetween(aRels, "QB", "Person B")).toEqual([]);
  });

  test("a direct relationship is found when A's list documents B as the object", () => {
    const withDirect = buildRelationships({
      subjectEntityId: "QA",
      subjectName: "Person A",
      wikidataRelationships: [raw({ type: "SPOUSE", targetId: "QB", targetLabel: "Person B" })],
      career: [],
      evidenceItems: [],
    });
    expect(directRelationshipsBetween(withDirect, "QB", "Person B")).toHaveLength(1);
  });
});

describe("relationshipChanges", () => {
  test("emits nothing when either snapshot is empty (a provider failure is not the end of a relationship)", () => {
    const rels = buildRelationships({
      subjectEntityId: "Q1",
      subjectName: "Jane Doe",
      wikidataRelationships: [raw()],
      career: [],
      evidenceItems: [],
    });
    expect(relationshipChanges("Q1", [], rels, "2026-09-05")).toEqual([]);
    expect(relationshipChanges("Q1", rels, [], "2026-09-05")).toEqual([]);
  });

  test("emits a RELATIONSHIP_CHANGE when a new documented relationship appears", () => {
    resetRelationshipIdCounter();
    const before = buildRelationships({ subjectEntityId: "Q1", subjectName: "Jane Doe", wikidataRelationships: [raw({ targetId: "Q100", targetLabel: "Alex Roe" })], career: [], evidenceItems: [] });
    const after = buildRelationships({
      subjectEntityId: "Q1",
      subjectName: "Jane Doe",
      wikidataRelationships: [raw({ targetId: "Q100", targetLabel: "Alex Roe" }), raw({ type: "MEMBER_OF", targetId: "Q300", targetLabel: "The Board", start: 2025 })],
      career: [],
      evidenceItems: [],
    });
    const changes = relationshipChanges("Q1", before, after, "2026-09-05");
    expect(changes).toHaveLength(1);
    expect(changes[0].changeType).toBe("RELATIONSHIP_CHANGE");
    expect(changes[0].title).toContain("The Board");
  });
});

describe("categoryOf", () => {
  test("every taxonomy member resolves to a category, unknowns fall to OTHER", () => {
    expect(categoryOf("SPOUSE")).toBe("PERSONAL");
    expect(categoryOf("OWNS")).toBe("BUSINESS");
    expect(categoryOf("APPEARED_WITH")).toBe("OTHER");
  });
});
