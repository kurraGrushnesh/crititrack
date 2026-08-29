"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {sanitizeControversies} = require("../lib/groq");

const base = {
  title: "Contract dispute",
  summary: "A disagreement with a studio, later settled.",
  category: "Legal",
  severity: 2,
  status: "resolved",
  year: 2021,
  sources: ["Variety"],
};

test("passes a well-formed record through", () => {
  const [r] = sanitizeControversies([base]);
  assert.equal(r.title, "Contract dispute");
  assert.equal(r.category, "Legal");
  assert.equal(r.severity, 2);
  assert.deepEqual(r.sources, ["Variety"]);
});

test("F03: drops an uncited claim at every severity", () => {
  // The gate used to start at severity 3, so a minor episode could reach
  // a profile with nothing behind it. F03's rule is that no record
  // reaches the UI without a source.
  const out = sanitizeControversies([
    {...base, severity: 5, sources: undefined},
    {...base, severity: 4, sources: []},
    {...base, severity: 3, sources: []},
    {...base, severity: 2, sources: []},
    {...base, severity: 1, sources: []},
  ]);
  assert.equal(out.length, 0, "an uncited claim must be discarded");
});

test("F03: keeps a minor claim that cites a source", () => {
  // The bar is naming a source, not being serious enough to need one.
  const out = sanitizeControversies([
    {...base, severity: 1, sources: ["Variety"]},
  ]);
  assert.equal(out.length, 1);
});

test("SEC-04: keeps a serious claim that cites a source", () => {
  const out = sanitizeControversies([
    {...base, severity: 5, sources: ["Reuters"]},
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].severity, 5);
});

test("clamps severity into 1-5 and rounds it", () => {
  assert.equal(sanitizeControversies([{...base, severity: 99}])[0].severity, 5);
  assert.equal(sanitizeControversies([{...base, severity: -3}])[0].severity, 1);
  assert.equal(sanitizeControversies([{...base, severity: 2.6}])[0].severity, 3);
});

test("normalises an unknown category and status", () => {
  const [r] = sanitizeControversies([
    {...base, category: "Nonsense", status: "whatever"},
  ]);
  assert.equal(r.category, "Other");
  assert.equal(r.status, "historical");
});

test("drops an implausible year rather than rendering it", () => {
  assert.equal("year" in sanitizeControversies([{...base, year: 1673}])[0], false);
  assert.equal("year" in sanitizeControversies([{...base, year: 3000}])[0], false);
  assert.equal(sanitizeControversies([{...base, year: 2019}])[0].year, 2019);
});

test("discards entries that are not usable records", () => {
  const out = sanitizeControversies([
    null, "a string", 42, {}, {summary: "no title"},
  ]);
  assert.equal(out.length, 0);
});

test("caps the number of records", () => {
  const many = Array.from({length: 20}, () => ({...base}));
  assert.equal(sanitizeControversies(many).length, 6);
});

test("returns an empty array for non-array input", () => {
  for (const v of [undefined, null, "x", 7, {}]) {
    assert.deepEqual(sanitizeControversies(v), []);
  }
});

test("truncates over-long strings instead of trusting them", () => {
  const [r] = sanitizeControversies([{...base, title: "x".repeat(500)}]);
  assert.equal(r.title.length, 140);
});
