import { describe, expect, it } from "vitest";
import {
  buildProfessionalIdentity,
  resolveCatalogueOccupation,
} from "./professional-identity";

describe("buildProfessionalIdentity", () => {
  it("keeps multiple professions — primary is the first resolved claim", () => {
    const id = buildProfessionalIdentity({
      occupations: ["Actor", "Film Producer", "Singer"],
      professionText: "American actor and producer",
    });
    expect(id.primary?.label).toBe("Actor");
    expect(id.secondary.map((p) => p.label).sort()).toEqual([
      "Film Producer",
      "Singer",
    ]);
    expect(id.empty).toBe(false);
  });

  it("derives industries from every matched occupation path", () => {
    const id = buildProfessionalIdentity({
      occupations: ["Software Engineer", "Entrepreneur"],
      professionText: "",
    });
    const industries = id.industries.map((i) => i.label);
    expect(industries).toContain("Software");
    expect(industries).toContain("Entrepreneurship");
  });

  it("surfaces a specialization under its parent occupation", () => {
    const id = buildProfessionalIdentity({
      occupations: ["Cardiologist"],
      professionText: "Cardiologist",
    });
    expect(id.primary?.label).toBe("Physician");
    expect(id.specializations[0].label).toBe("Cardiologist");
    expect(id.specializations[0].occupation).toBe("Physician");
  });

  it("treats an org/seat profession line as a role, not an occupation", () => {
    const id = buildProfessionalIdentity({
      occupations: ["Businessperson"],
      professionText: "Chief executive of Apple",
    });
    expect(id.primary?.label).toBe("Entrepreneur");
    expect(id.roles).toEqual(["Chief executive of Apple"]);
  });

  it("falls back to the profession line only when no claim resolved", () => {
    const id = buildProfessionalIdentity({
      occupations: ["nonexistent occupation"],
      professionText: "Journalist",
    });
    expect(id.primary?.label).toBe("Journalist");
    expect(id.unresolved).toEqual(["nonexistent occupation"]);
  });

  it("is empty (renders nothing) when nothing resolves and there is no role", () => {
    const id = buildProfessionalIdentity({
      occupations: ["mystery"],
      professionText: "Mystic seer",
    });
    expect(id.empty).toBe(true);
    expect(id.expertise).toEqual([]);
  });

  it("still shows a role from the profession line even if nothing resolves", () => {
    const id = buildProfessionalIdentity({
      occupations: [],
      professionText: "President of Somewhere",
    });
    expect(id.primary).toBeNull();
    expect(id.roles).toEqual(["President of Somewhere"]);
    expect(id.empty).toBe(false);
  });

  it("never invents expertise", () => {
    const id = buildProfessionalIdentity({
      occupations: ["Physicist"],
      professionText: "Theoretical physicist",
    });
    expect(id.expertise).toEqual([]);
  });
});

describe("resolveCatalogueOccupation", () => {
  it("resolves a descriptor with a nationality prefix", () => {
    expect(resolveCatalogueOccupation("Indian javelin thrower")?.label).toBe(
      "Track and Field Athlete",
    );
    expect(resolveCatalogueOccupation("American film actor and director")?.label).toBe(
      "Actor",
    );
    expect(resolveCatalogueOccupation("Portuguese footballer")?.label).toBe(
      "Footballer",
    );
  });

  it("returns null when the descriptor does not map", () => {
    expect(resolveCatalogueOccupation("Fabricated composite")).toBeNull();
  });
});
