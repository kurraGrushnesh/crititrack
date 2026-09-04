"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildTimeline,
  controversyEvents,
  attentionSpikeEvents,
  sentimentShiftEvents,
} = require("../lib/timeline");

test("controversyEvents: year-only records are placed on Jan 1 and flagged approximate", () => {
  const [e] = controversyEvents([
    {title: "Tax dispute", year: 2019, severity: 3, summary: "x", status: "resolved"},
  ]);
  assert.equal(e.date, "2019-01-01");
  assert.equal(e.approxDate, true);
  assert.equal(e.kind, "controversy");
  assert.equal(e.severity, 3);
});

test("controversyEvents: a record with no year is dropped, not guessed", () => {
  assert.deepEqual(controversyEvents([{title: "Undated"}]), []);
});

test("attentionSpikeEvents: flags only days well above the period mean", () => {
  const series = [
    ...Array.from({length: 9}, (_, i) => ({date: `2026-03-0${i + 1}`, views: 100})),
    {date: "2026-03-10", views: 900},
  ];
  const events = attentionSpikeEvents(series);
  assert.equal(events.length, 1);
  assert.equal(events[0].date, "2026-03-10");
  assert.equal(events[0].kind, "attention-spike");
});

test("attentionSpikeEvents: a flat series produces nothing", () => {
  const series = Array.from({length: 8}, (_, i) => ({
    date: `2026-03-0${i + 1}`,
    views: 200,
  }));
  assert.deepEqual(attentionSpikeEvents(series), []);
});

test("sentimentShiftEvents: emits on a jump past the threshold with direction", () => {
  const [e] = sentimentShiftEvents([
    {date: "2026-03-01", score: 50},
    {date: "2026-03-02", score: 68},
  ]);
  assert.equal(e.date, "2026-03-02");
  assert.equal(e.change, 18);
  assert.match(e.title, /rose sharply/);
});

test("sentimentShiftEvents: ignores a small day-to-day wobble", () => {
  assert.deepEqual(
      sentimentShiftEvents([
        {date: "2026-03-01", score: 50},
        {date: "2026-03-02", score: 55},
      ]),
      [],
  );
});

test("buildTimeline: merges sources newest-first, controversy before attention on a shared day", () => {
  const events = buildTimeline({
    controversies: [{title: "Older", year: 2020}],
    attentionSeries: [
      ...Array.from({length: 9}, (_, i) => ({date: `2026-03-0${i + 1}`, views: 50})),
      {date: "2026-03-10", views: 500},
    ],
    sentimentHistory: [
      {date: "2026-03-09", score: 40},
      {date: "2026-03-10", score: 70},
    ],
  });
  assert.equal(events[0].date, "2026-03-10");
  assert.equal(events[0].kind, "attention-spike");
  assert.equal(events[1].kind, "sentiment-shift");
  assert.equal(events[events.length - 1].kind, "controversy");
});
