import { describe, expect, it } from "vitest";
import {
  METHODOLOGY_CHANGES,
  CURRENT_METHODOLOGY_VERSION,
  methodologyChange,
  methodologyStamp,
} from "./methodology-version";

describe("methodology changelog", () => {
  it("is ordered newest-first with unique, descending versions", () => {
    const versions = METHODOLOGY_CHANGES.map((c) => c.version);
    expect(versions).toEqual([...versions].sort((a, b) => b - a));
    expect(new Set(versions).size).toBe(versions.length);
  });

  it("every entry has an ISO date and a summary", () => {
    for (const c of METHODOLOGY_CHANGES) {
      expect(c.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(c.summary.length).toBeGreaterThan(10);
    }
  });

  it("only the current version is recorded as an exact date", () => {
    for (const c of METHODOLOGY_CHANGES) {
      if (c.version === CURRENT_METHODOLOGY_VERSION) {
        expect(c.approxDate).not.toBe(true);
      } else {
        expect(c.approxDate).toBe(true);
      }
    }
  });

  it("CURRENT_METHODOLOGY_VERSION is the newest entry", () => {
    expect(CURRENT_METHODOLOGY_VERSION).toBe(METHODOLOGY_CHANGES[0].version);
  });

  it("methodologyChange looks up by version", () => {
    expect(methodologyChange(1)?.version).toBe(1);
    expect(methodologyChange(999)).toBeNull();
  });

  it("methodologyStamp reads 'Method v<n> · <date>'", () => {
    expect(methodologyStamp(CURRENT_METHODOLOGY_VERSION)).toMatch(
      /^Method v\d+ · \d{4}-\d{2}-\d{2}$/,
    );
  });
});
