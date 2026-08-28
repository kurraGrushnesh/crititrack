"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {toSnapshots} = require("../lib/store");

test("maps the model's weekday labels onto trailing calendar dates", () => {
  const out = toSnapshots(
      [
        {day: "Mon", score: 60},
        {day: "Tue", score: 65},
        {day: "Wed", score: 70},
      ],
      "admiration",
  );

  assert.equal(out.length, 3);
  // Newest entry is today; each id is a real ISO date, so Firestore's
  // lexicographic ordering is also chronological.
  for (const s of out) assert.match(s.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(out[0].date < out[1].date);
  assert.ok(out[1].date < out[2].date);
  assert.equal(out[2].date, new Date().toISOString().slice(0, 10));
});

test("keeps the original label alongside the real date", () => {
  const [s] = toSnapshots([{day: "Mon", score: 60}], "joy");
  assert.equal(s.label, "Mon");
  assert.equal(s.dominantEmotion, "joy");
});

test("dates are the document ids, so a rerun overwrites rather than piles up", () => {
  const a = toSnapshots([{day: "Mon", score: 60}], "joy");
  const b = toSnapshots([{day: "Mon", score: 80}], "joy");
  assert.equal(a[0].date, b[0].date, "same day must reuse the same id");
});

test("coerces an unusable score to the neutral midpoint", () => {
  const out = toSnapshots(
      [{day: "Mon"}, {day: "Tue", score: "abc"}, {day: "Wed", score: null}],
      "neutral",
  );
  for (const s of out) assert.equal(s.score, 50);
});

test("falls back to a neutral emotion when none is supplied", () => {
  const [s] = toSnapshots([{day: "Mon", score: 60}], undefined);
  assert.equal(s.dominantEmotion, "neutral");
});

test("returns an empty array for non-array input", () => {
  for (const v of [undefined, null, "x", 7, {}]) {
    assert.deepEqual(toSnapshots(v, "joy"), []);
  }
});
