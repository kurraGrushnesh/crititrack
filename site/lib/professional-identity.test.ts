import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import {
  buildProfessionalIdentity,
  resolveCatalogueOccupation,
} from "./professional-identity";
import ProfessionalIdentity from "../components/ProfessionalIdentity";

describe("buildProfessionalIdentity", () => {
  it("primary is the first resolved claim; others become secondary", () => {
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
    });
    expect(id.industries.map((i) => i.label)).toContain("Software");
    expect(id.industries.map((i) => i.label)).toContain("Entrepreneurship");
  });

  it("surfaces a specialization under its parent occupation", () => {
    const id = buildProfessionalIdentity({ occupations: ["Cardiologist"] });
    expect(id.primary?.label).toBe("Physician");
    expect(id.specializations[0]).toMatchObject({
      label: "Cardiologist",
      occupation: "Physician",
    });
  });

  it("treats an org/seat profession line as a current role, not an occupation", () => {
    const id = buildProfessionalIdentity({
      occupations: ["Businessperson"],
      professionText: "Chief executive of Apple",
    });
    expect(id.primary?.label).toBe("Entrepreneur");
    expect(id.roles).toEqual(["Chief executive of Apple"]);
  });

  it("falls back to the profession line only when no claim resolved", () => {
    const id = buildProfessionalIdentity({
      occupations: ["not a real occupation"],
      professionText: "Journalist",
    });
    expect(id.primary?.label).toBe("Journalist");
    expect(id.unresolved).toEqual(["not a real occupation"]);
  });

  it("maps Wikidata field-of-work labels to expertise, title-cased and capped", () => {
    const id = buildProfessionalIdentity({
      occupations: ["Physicist"],
      fieldsOfWork: [
        "artificial intelligence",
        "artificial intelligence",
        "quantum mechanics",
        "a",
        "b",
        "c",
        "d",
        "e",
        "f",
        "g",
      ],
    });
    expect(id.expertise.slice(0, 2)).toEqual([
      "Artificial Intelligence",
      "Quantum Mechanics",
    ]);
    expect(id.expertise.length).toBeLessThanOrEqual(6);
  });

  it("never invents expertise when there is no field-of-work data", () => {
    const id = buildProfessionalIdentity({
      occupations: ["Physicist"],
      professionText: "Theoretical physicist",
    });
    expect(id.expertise).toEqual([]);
  });

  describe("career status (derived, never invented)", () => {
    it("is Executive for a founder / CEO", () => {
      expect(
        buildProfessionalIdentity({ occupations: ["Chief Executive Officer"] })
          .careerStatus,
      ).toBe("Executive");
    });
    it("is Former when the profession/role says so", () => {
      expect(
        buildProfessionalIdentity({
          occupations: ["Tennis Player"],
          professionText: "Swiss former tennis player",
        }).careerStatus,
      ).toBe("Former");
    });
    it("is Academic for a professor", () => {
      expect(
        buildProfessionalIdentity({ occupations: ["Professor"] }).careerStatus,
      ).toBe("Academic");
    });
    it("is Researcher for a scientist", () => {
      expect(
        buildProfessionalIdentity({ occupations: ["Physicist"] }).careerStatus,
      ).toBe("Researcher");
    });
    it("is Active for a living figure with a resolved profession and no other signal", () => {
      expect(
        buildProfessionalIdentity({ occupations: ["Actor"] }).careerStatus,
      ).toBe("Active");
    });
    it("is null when the person is deceased", () => {
      expect(
        buildProfessionalIdentity({ occupations: ["Actor"], deceased: true })
          .careerStatus,
      ).toBeNull();
    });
  });

  it("is empty (renders nothing) when nothing resolves and there is no role or expertise", () => {
    const id = buildProfessionalIdentity({
      occupations: ["mystery"],
      professionText: "Mystic seer",
    });
    expect(id.empty).toBe(true);
  });
});

describe("resolveCatalogueOccupation", () => {
  it("resolves a descriptor with a nationality prefix", () => {
    expect(resolveCatalogueOccupation("Indian javelin thrower")?.label).toBe(
      "Track and Field Athlete",
    );
    expect(
      resolveCatalogueOccupation("American film actor and director")?.label,
    ).toBe("Actor");
  });

  it("returns null when the descriptor does not map", () => {
    expect(resolveCatalogueOccupation("Fabricated composite")).toBeNull();
  });
});

describe("<ProfessionalIdentity /> rendering", () => {
  function render(identity: ReturnType<typeof buildProfessionalIdentity>) {
    return renderToStaticMarkup(
      createElement(ProfessionalIdentity, { identity }),
    );
  }

  it("renders every row that has data for a multi-profession figure", () => {
    const html = render(
      buildProfessionalIdentity({
        occupations: ["chief executive officer", "computer scientist", "engineer"],
        professionText: "Chief Executive Officer of Microsoft",
        fieldsOfWork: ["cloud computing"],
      }),
    );
    expect(html).toContain("Professional Identity");
    expect(html).toContain(">Primary<");
    expect(html).toContain(">Also<");
    expect(html).toMatch(/>Current roles?</);
    expect(html).toMatch(/>Industr(y|ies)</);
    expect(html).toContain(">Expertise<");
    expect(html).toContain(">Status<");
    expect(html).toContain("Cloud Computing");
    // A semantic heading and a definition list, not a table.
    expect(html).toMatch(/<h2[^>]*>Professional Identity<\/h2>/);
    expect(html).toContain("<dl");
    expect(html).not.toContain("<table");
  });

  it("renders nothing at all when the identity is empty", () => {
    expect(
      render(
        buildProfessionalIdentity({ occupations: [], professionText: "" }),
      ),
    ).toBe("");
  });

  it("puts chips in flex-wrap containers so long lists never overflow on mobile", () => {
    const html = render(
      buildProfessionalIdentity({
        occupations: [
          "actor",
          "film producer",
          "film director",
          "singer",
          "screenwriter",
        ],
      }),
    );
    // No inline fixed widths; wrapping is the container's job.
    expect(html).not.toMatch(/style="[^"]*width/);
    expect((html.match(/class="prof-chips"/g) ?? []).length).toBeGreaterThan(0);
  });
});
