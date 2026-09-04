import { describe, expect, it } from "vitest";
import {
  buildTimeline,
  parseTimelineEvent,
  sentimentShiftEvents,
} from "./timeline";
import type { TrendPoint } from "./api";

const trend = (...s: number[]): TrendPoint[] =>
  s.map((score, i) => ({ date: `2026-03-0${i + 1}`, score, mentions: 0 }));

describe("parseTimelineEvent", () => {
  it("accepts a well-formed backend event", () => {
    expect(
      parseTimelineEvent({
        date: "2019-01-01",
        approxDate: true,
        kind: "controversy",
        title: "Tax dispute",
        detail: "x",
        severity: 3,
      }),
    ).toMatchObject({ date: "2019-01-01", kind: "controversy", severity: 3 });
  });

  it("rejects an unknown kind or a non-ISO date", () => {
    expect(parseTimelineEvent({ date: "2019", kind: "controversy" })).toBeNull();
    expect(
      parseTimelineEvent({ date: "2019-01-01", kind: "mystery" }),
    ).toBeNull();
    expect(parseTimelineEvent(null)).toBeNull();
  });
});

describe("sentimentShiftEvents", () => {
  it("emits on a jump past the threshold", () => {
    const [e] = sentimentShiftEvents(trend(50, 65));
    expect(e.change).toBe(15);
    expect(e.title).toMatch(/rose sharply/);
  });

  it("ignores a small wobble", () => {
    expect(sentimentShiftEvents(trend(50, 54, 51))).toEqual([]);
  });
});

describe("buildTimeline", () => {
  it("merges backend events with client-derived shifts, newest first", () => {
    const out = buildTimeline(
      [
        { date: "2020-01-01", kind: "controversy", title: "Old", detail: "" },
        {
          date: "2026-03-02",
          kind: "attention-spike",
          title: "Attention spike",
          detail: "",
        },
      ],
      trend(50, 50, 70),
    );
    expect(out.map((e) => e.kind)).toEqual([
      "sentiment-shift",
      "attention-spike",
      "controversy",
    ]);
  });

  it("is empty when there is nothing dated", () => {
    expect(buildTimeline(null, [])).toEqual([]);
  });
});
