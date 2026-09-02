import { describe, expect, it } from "vitest";
import { relativeTime, latestOf } from "./time";

const NOW = Date.parse("2026-09-02T12:00:00Z");

describe("relativeTime", () => {
  it("buckets by minute, hour, day", () => {
    expect(relativeTime("2026-09-02T11:59:40Z", NOW)).toBe("just now");
    expect(relativeTime("2026-09-02T11:45:00Z", NOW)).toBe("15m ago");
    expect(relativeTime("2026-09-02T09:00:00Z", NOW)).toBe("3h ago");
    expect(relativeTime("2026-08-31T12:00:00Z", NOW)).toBe("2d ago");
  });

  it("falls back to a dated string past four weeks", () => {
    expect(relativeTime("2026-06-01T12:00:00Z", NOW)).toBe("Jun 1, 2026");
  });

  it("treats a future timestamp as just now", () => {
    expect(relativeTime("2026-09-02T13:00:00Z", NOW)).toBe("just now");
  });

  it("returns empty for an unparseable value", () => {
    expect(relativeTime("nope", NOW)).toBe("");
  });
});

describe("latestOf", () => {
  it("returns the most recent parseable timestamp", () => {
    expect(
      latestOf([
        "2026-08-01T00:00:00Z",
        undefined,
        "2026-09-01T00:00:00Z",
        "bad",
      ]),
    ).toBe("2026-09-01T00:00:00Z");
  });

  it("returns null when nothing parses", () => {
    expect(latestOf([undefined, "bad"])).toBeNull();
  });
});
