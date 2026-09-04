import { describe, expect, it } from "vitest";
import { buildCareerIntelligence } from "./career";

const src = { name: "Wikidata", url: "https://www.wikidata.org/wiki/Q42" };

describe("buildCareerIntelligence", () => {
  it("reports unavailable when there are no rows", () => {
    const c = buildCareerIntelligence({ career: [] });
    expect(c.available).toBe(false);
    expect(c.timeline).toEqual([]);
    expect(c.insights.start).toBeNull();
  });

  it("orders the timeline oldest-first and flags the open role as current", () => {
    const c = buildCareerIntelligence({
      career: [
        { start: 2021, end: null, role: "CEO", organization: "Firm C", source: src },
        { start: 2014, end: 2018, role: "Engineer", organization: "Firm A", source: src },
        { start: 2018, end: 2021, role: "Engineering Lead", organization: "Firm B", source: src },
      ],
    });
    expect(c.available).toBe(true);
    expect(c.timeline.map((e) => e.start)).toEqual([2014, 2018, 2021]);
    expect(c.timeline[2].current).toBe(true);
    expect(c.timeline[0].current).toBe(false);
  });

  it("derives start, current, transitions and leadership from the rows only", () => {
    const c = buildCareerIntelligence({
      career: [
        { start: 2014, end: 2018, role: "Engineer", organization: "Firm A", source: src },
        { start: 2018, end: null, role: "Chief Executive Officer", organization: "Firm B", source: src },
      ],
    });
    expect(c.insights.start).toBe("2014 · Engineer, Firm A");
    expect(c.insights.current).toBe("Chief Executive Officer, Firm B · since 2018");
    expect(c.insights.transitions).toEqual(["2018 · Firm A → Firm B"]);
    expect(c.insights.leadershipRoles).toEqual(["Chief Executive Officer"]);
  });

  it("recognises a founder role", () => {
    const c = buildCareerIntelligence({
      career: [
        { start: 2010, role: "Co-founder", organization: "Startup X", source: src },
      ],
    });
    expect(c.insights.founder).toBe(true);
  });

  it("drops a row with neither role nor organisation and coerces junk", () => {
    const c = buildCareerIntelligence({
      career: [
        { start: "nope", end: null, role: "", organization: "", source: src },
        { start: 2000, role: "Reporter", organization: "Paper", source: src },
        "garbage",
        null,
      ] as unknown[],
    });
    expect(c.timeline).toHaveLength(1);
    expect(c.timeline[0].start).toBe(2000);
    expect(c.timeline[0].role).toBe("Reporter");
  });

  it("collects organisations most-recent-first without duplicates", () => {
    const c = buildCareerIntelligence({
      career: [
        { start: 2005, end: 2010, role: "Analyst", organization: "Bank", source: src },
        { start: 2010, end: null, role: "Partner", organization: "Fund", source: src },
      ],
      organizations: ["Bank", "Charity Board"],
    });
    expect(c.organizations).toEqual(["Fund", "Bank", "Charity Board"]);
  });
});
