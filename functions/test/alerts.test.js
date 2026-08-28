"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  detectSpike,
  shouldAlert,
  buildAlertMessage,
  MIN_HISTORY,
  COOLDOWN_HOURS,
} = require("../lib/alerts");

/** Steady coverage: a very small standard deviation. */
const steady = [60, 61, 60, 62, 61, 60, 61];

/** Noisy coverage: swings are normal for this figure. */
const noisy = [30, 75, 45, 80, 35, 70, 40];

test("flags a genuine collapse in sentiment", () => {
  const s = detectSpike(steady, 35);
  assert.equal(s.isSpike, true);
  assert.equal(s.direction, "down");
  assert.ok(s.change < -20);
});

test("flags a genuine surge", () => {
  const s = detectSpike(steady, 90);
  assert.equal(s.isSpike, true);
  assert.equal(s.direction, "up");
});

test("does NOT fire on a small wobble in very steady coverage", () => {
  // The whole point of the second condition. Steady coverage has a tiny
  // standard deviation, so 4 points clears the z-score bar comfortably —
  // z is over 6 here — while meaning nothing. "Statistically unusual" is
  // not the same as "worth a notification".
  const s = detectSpike(steady, 65);
  assert.ok(Math.abs(s.zScore) > 1.5, "z-score alone would have fired");
  assert.equal(s.isSpike, false, "but the absolute change is only ~4 points");
});

test("does NOT fire on normal swings for a volatile figure", () => {
  // A figure whose coverage always swings should not alert every run.
  const s = detectSpike(noisy, 75);
  assert.equal(s.isSpike, false);
});

test("the same score is a spike for one figure and not another", () => {
  // 75 is unremarkable for the volatile figure and a large move for the
  // steady one. The baseline is per-figure, which is the point.
  assert.equal(detectSpike(noisy, 75).isSpike, false);
  assert.equal(detectSpike(steady, 75).isSpike, true);
});

test("stays silent until there is enough history for a baseline", () => {
  const short = Array(MIN_HISTORY - 1).fill(60);
  assert.equal(detectSpike(short, 10).isSpike, false);

  const enough = Array(MIN_HISTORY).fill(60);
  assert.equal(
      detectSpike(enough, 10).isSpike,
      true,
      "with a baseline, the same collapse should fire",
  );
});

test("perfectly flat history does not divide by zero", () => {
  const flat = [50, 50, 50, 50, 50, 50];
  const small = detectSpike(flat, 53);
  assert.equal(Number.isFinite(small.zScore), true);
  assert.equal(small.isSpike, false, "3 points is still not enough");

  const large = detectSpike(flat, 80);
  assert.equal(large.isSpike, true);
  assert.equal(Number.isFinite(large.zScore), true);
});

test("tolerates malformed history and scores", () => {
  for (const h of [null, undefined, "nope", [1, "x", null, 2]]) {
    const s = detectSpike(h, 50);
    assert.equal(s.isSpike, false);
    assert.equal(Number.isFinite(s.zScore), true);
  }
  assert.equal(detectSpike(steady, NaN).isSpike, false);
  assert.equal(detectSpike(steady, undefined).isSpike, false);
});

test("no spike means no alert, whatever the history", () => {
  assert.equal(shouldAlert({isSpike: false}, null), false);
  assert.equal(shouldAlert(null, null), false);
  assert.equal(shouldAlert(undefined, null), false);
});

test("a first spike alerts immediately", () => {
  assert.equal(shouldAlert({isSpike: true}, null), true);
});

test("a sustained event does not re-alert during the cooldown", () => {
  // A scandal produces a spike on every run for days. Without this the
  // user is notified every thirty minutes about the same thing.
  const now = new Date("2026-08-28T12:00:00Z");
  const anHourAgo = new Date("2026-08-28T11:00:00Z");
  assert.equal(shouldAlert({isSpike: true}, anHourAgo, now), false);
});

test("alerts again once the cooldown has elapsed", () => {
  const now = new Date("2026-08-28T12:00:00Z");
  const old = new Date(now.getTime() - (COOLDOWN_HOURS + 1) * 36e5);
  assert.equal(shouldAlert({isSpike: true}, old, now), true);
});

test("an unreadable last-alerted timestamp does not suppress forever", () => {
  // Failing closed here would silently disable alerts for that figure.
  assert.equal(shouldAlert({isSpike: true}, "not a date"), true);
});

test("accepts an ISO string as well as a Date", () => {
  const now = new Date("2026-08-28T12:00:00Z");
  assert.equal(
      shouldAlert({isSpike: true}, "2026-08-28T11:00:00Z", now),
      false,
  );
});

test("the message says what moved, never why", () => {
  // "Why" on a lock screen would be an unsourced claim about a named
  // living person, with no room for the provenance label the rest of the
  // product carries.
  const s = detectSpike(steady, 35);
  const m = buildAlertMessage("Jane Doe", s, 35);

  assert.match(m.title, /Jane Doe/);
  assert.match(m.title, /down/);
  assert.match(m.body, /26 points below/);
  assert.match(m.body, /35\/100/);

  for (const loaded of ["scandal", "allegation", "accused", "controversy"]) {
    assert.ok(
        !m.body.toLowerCase().includes(loaded) &&
      !m.title.toLowerCase().includes(loaded),
        `must not characterise the cause ("${loaded}")`,
    );
  }
});

test("message direction follows the movement", () => {
  const up = buildAlertMessage("X", detectSpike(steady, 90), 90);
  assert.match(up.title, /up sharply/);
  assert.match(up.body, /above the recent average/);

  const down = buildAlertMessage("X", detectSpike(steady, 30), 30);
  assert.match(down.title, /down sharply/);
  assert.match(down.body, /below the recent average/);
});
