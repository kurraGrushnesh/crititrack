import { describe, expect, it } from "vitest";
import {
  TAXONOMY,
  SECTORS,
  OCCUPATIONS,
  SPECIALIZATIONS,
  TAXONOMY_STATS,
  getOccupation,
  occupationPath,
  resolveOccupation,
  resolveIndustry,
  normalizeLabel,
} from "./index";

describe("taxonomy structure", () => {
  it("every occupation resolves a full sector→family path", () => {
    for (const occ of OCCUPATIONS) {
      const path = occupationPath(occ.id);
      expect(path, occ.id).not.toBeNull();
      expect(path?.sector).toBeTruthy();
      expect(path?.industry).toBeTruthy();
      expect(path?.family).toBeTruthy();
    }
  });

  it("occupation and specialization ids are unique", () => {
    const occIds = OCCUPATIONS.map((o) => o.id);
    expect(new Set(occIds).size).toBe(occIds.length);
    const specIds = SPECIALIZATIONS.map((s) => s.id);
    expect(new Set(specIds).size).toBe(specIds.length);
  });

  it("every specialization points at a real occupation", () => {
    for (const s of SPECIALIZATIONS) {
      expect(getOccupation(s.occupationId), s.id).toBeDefined();
    }
  });

  it("covers a broad set of sectors and a few hundred occupations", () => {
    expect(SECTORS.length).toBeGreaterThanOrEqual(20);
    expect(TAXONOMY_STATS.occupations).toBeGreaterThanOrEqual(200);
    expect(TAXONOMY_STATS.specializations).toBeGreaterThanOrEqual(120);
  });

  it("nested tree ids match the flattened counts", () => {
    let occ = 0;
    for (const s of TAXONOMY)
      for (const i of s.industries)
        for (const f of i.families) occ += f.occupations.length;
    expect(occ).toBe(TAXONOMY_STATS.occupations);
  });
});

describe("normalizeLabel", () => {
  it("folds case, accents and punctuation", () => {
    expect(normalizeLabel("Association Football (Soccer) Player")).toBe(
      "association football soccer player",
    );
    expect(normalizeLabel("Ballon d'Or winner")).toBe("ballon d or winner");
  });
});

describe("resolveOccupation", () => {
  it("matches a canonical label", () => {
    const r = resolveOccupation("Actor");
    expect(r?.occupation.id).toBe("actor");
    expect(r?.path.sector).toBe("Film & Television");
    expect(r?.specialization).toBeNull();
  });

  it("matches an alias to the same occupation, keeping the raw label available", () => {
    expect(resolveOccupation("Software Developer")?.occupation.id).toBe(
      "software-engineer",
    );
    expect(resolveOccupation("Programmer")?.occupation.id).toBe(
      "software-engineer",
    );
    expect(resolveOccupation("Solicitor")?.occupation.id).toBe("lawyer");
  });

  it("maps a specialization onto its parent occupation", () => {
    const r = resolveOccupation("Cardiologist");
    expect(r?.occupation.id).toBe("physician");
    expect(r?.specialization?.label).toBe("Cardiologist");
    const b = resolveOccupation("Batsman");
    expect(b?.occupation.id).toBe("cricketer");
    expect(b?.specialization?.label).toBe("Batsman");
  });

  it("strips leading noise words", () => {
    expect(resolveOccupation("professional tennis player")?.occupation.id).toBe(
      "tennis-player",
    );
    expect(resolveOccupation("former politician")?.occupation.id).toBe(
      "politician",
    );
  });

  it("falls back to a contained multi-word phrase", () => {
    expect(
      resolveOccupation("association football player")?.occupation.id,
    ).toBe("footballer");
  });

  it("returns null for something with no mapping, rather than guessing", () => {
    expect(resolveOccupation("time traveller")).toBeNull();
    expect(resolveOccupation("")).toBeNull();
    expect(resolveOccupation("x")).toBeNull();
  });

  it("resolveIndustry maps an industry alias", () => {
    expect(resolveIndustry("AI")?.id).toBe("artificial-intelligence");
    expect(resolveIndustry("Banking")?.id).toBe("banking");
    expect(resolveIndustry("nonsense")).toBeNull();
  });
});
