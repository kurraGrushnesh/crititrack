"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {todaySnapshot, isCacheFresh} = require("../lib/store");

const measured = {
  overallScore: 63.4,
  sampleSize: 12,
  positiveCount: 5,
  negativeCount: 3,
  neutralCount: 4,
  dominantEmotion: "admiration",
  confidence: 0.71,
};

test("records one day per refresh, keyed by today's date", () => {
  // The predecessor wrote seven, backdated from the model's invented
  // weekday series. This collection feeds spike detection and the compare
  // correlations, so those seven were fabricated history being treated as
  // observation.
  const s = todaySnapshot(measured, new Date("2026-03-04T09:00:00Z"));

  assert.equal(s.date, "2026-03-04");
  assert.match(s.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(s.label, "2026-03-04");
});

test("dates are the document ids, so a rerun updates rather than piles up", () => {
  const morning = todaySnapshot(measured, new Date("2026-03-04T06:00:00Z"));
  const evening = todaySnapshot(measured, new Date("2026-03-04T21:00:00Z"));
  assert.equal(morning.date, evening.date);
});

test("carries the counts the ensemble actually measured", () => {
  const s = todaySnapshot(measured);

  assert.equal(s.positiveCount, 5);
  assert.equal(s.negativeCount, 3);
  assert.equal(s.neutralCount, 4);
  assert.equal(s.totalMentions, 12);
  assert.equal(s.sampleSize, 12);
  assert.equal(s.score, 63.4);
  assert.equal(s.confidence, 0.71);
  assert.equal(s.dominantEmotion, "admiration");
});

test("flags itself as an observation", () => {
  // readSnapshotHistory keeps only flagged rows, which is what stops the
  // previously generated series from being correlated forever.
  assert.equal(todaySnapshot(measured).measured, true);
});

test("coerces an unusable score to the neutral midpoint", () => {
  for (const v of [undefined, null, "abc", NaN]) {
    assert.equal(todaySnapshot({...measured, overallScore: v}).score, 50);
  }
});

test("never records a negative count", () => {
  const s = todaySnapshot({
    ...measured,
    sampleSize: -4,
    positiveCount: -1,
  });
  assert.equal(s.totalMentions, 0);
  assert.equal(s.positiveCount, 0);
});

test("rounds counts to whole items", () => {
  const s = todaySnapshot({...measured, sampleSize: 11.6, positiveCount: 2.4});
  assert.equal(s.totalMentions, 12);
  assert.equal(s.positiveCount, 2);
});

test("falls back to a neutral emotion when none is supplied", () => {
  assert.equal(todaySnapshot({...measured, dominantEmotion: undefined})
      .dominantEmotion, "neutral");
});

test("survives an empty sentiment object", () => {
  // A refresh that found no coverage still records that it looked.
  const s = todaySnapshot({});
  assert.equal(s.score, 50);
  assert.equal(s.totalMentions, 0);
  assert.equal(s.measured, true);
});

test("isCacheFresh: within the window is fresh, past it is not", () => {
  const now = Date.parse("2026-09-03T12:00:00Z");
  const max = 6 * 60 * 60 * 1000;
  assert.equal(isCacheFresh("2026-09-03T09:00:00Z", max, now), true);
  assert.equal(isCacheFresh("2026-09-03T05:59:00Z", max, now), false);
  assert.equal(isCacheFresh("2026-09-03T12:00:00Z", max, now), true);
});

test("isCacheFresh: a future stamp or an unparseable one is not fresh", () => {
  const now = Date.parse("2026-09-03T12:00:00Z");
  const max = 6 * 60 * 60 * 1000;
  assert.equal(isCacheFresh("2026-09-03T13:00:00Z", max, now), false);
  assert.equal(isCacheFresh("not a date", max, now), false);
  assert.equal(isCacheFresh("", max, now), false);
  assert.equal(isCacheFresh(undefined, max, now), false);
});
