"use strict";

const test = require("node:test");
const assert = require("node:assert");

const {summarise, stamp, isoFromStamp} = require("../lib/pageviews");

const series = (...views) =>
  views.map((v, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, "0")}`,
    views: v,
  }));

test("summarise returns null for nothing rather than a zeroed object", () => {
  assert.equal(summarise([]), null);
  assert.equal(summarise(null), null);
  assert.equal(summarise(undefined), null);
});

test("counts days, total, mean and median", () => {
  const s = summarise(series(10, 20, 30, 40));
  assert.equal(s.days, 4);
  assert.equal(s.total, 100);
  assert.equal(s.mean, 25);
  assert.equal(s.median, 25);
});

test("median of an odd-length series is the middle value", () => {
  assert.equal(summarise(series(5, 100, 7)).median, 7);
});

test("peak reports the day, not just the number", () => {
  const s = summarise(series(10, 900, 30));
  assert.equal(s.peak.views, 900);
  // The date is the point: it says which day's coverage to go and read.
  assert.equal(s.peak.date, "2026-01-02");
});

test("orders by date before summarising, so input order cannot skew it", () => {
  const shuffled = [
    {date: "2026-01-03", views: 30},
    {date: "2026-01-01", views: 10},
    {date: "2026-01-02", views: 20},
  ];
  const s = summarise(shuffled);
  assert.equal(s.latest.date, "2026-01-03");
  assert.equal(s.peak.date, "2026-01-03");
});

test("week-over-week change needs a fortnight, not a fortnight minus one", () => {
  // Thirteen days cannot be split into two clean weeks, so no number is
  // reported rather than one computed from a partial baseline.
  assert.equal(summarise(series(...Array(13).fill(10))).changePct, null);
  assert.equal(summarise(series(...Array(14).fill(10))).changePct, 0);
});

test("change is week over week, not day over day", () => {
  // Seven days at 10, then seven at 20: a doubling.
  const s = summarise(series(...Array(7).fill(10), ...Array(7).fill(20)));
  assert.equal(s.changePct, 100);
});

test("a halving reads as -50, not as a rounding artefact", () => {
  const s = summarise(series(...Array(7).fill(100), ...Array(7).fill(50)));
  assert.equal(s.changePct, -50);
});

test("a zero baseline yields no percentage instead of Infinity", () => {
  const s = summarise(series(...Array(7).fill(0), ...Array(7).fill(50)));
  assert.equal(s.changePct, null);
});

test("stamp formats the date the metrics API expects", () => {
  assert.equal(stamp(new Date(Date.UTC(2026, 6, 1))), "20260701");
});

test("isoFromStamp reverses the API's hour-suffixed timestamps", () => {
  assert.equal(isoFromStamp("2026070100"), "2026-07-01");
  assert.equal(isoFromStamp("garbage"), null);
  assert.equal(isoFromStamp(""), null);
});
