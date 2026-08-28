"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {corroborate, distinctiveTerms} = require("../lib/corroborate");

const corpus = [
  "Actor named in ongoing tax evasion investigation by federal authorities",
  "Studio confirms production delay amid legal proceedings",
];

const claim = (over) => ({
  title: "Something happened",
  summary: "A description.",
  severity: 5,
  ...over,
});

test("SEC-04: keeps a serious claim the coverage supports", () => {
  const {kept, dropped} = corroborate(
      [
        claim({
          title: "Tax evasion investigation",
          summary: "Federal authorities opened an investigation.",
        }),
      ],
      corpus,
  );
  assert.equal(kept.length, 1);
  assert.equal(dropped.length, 0);
  assert.equal(kept[0].corroborated, true);
});

test("SEC-04: drops a serious claim nothing retrieved mentions", () => {
  // The exact shape of a defamation claim: a severe allegation about a
  // named living person that no source supports.
  const {kept, dropped} = corroborate(
      [
        claim({
          title: "Alleged nightclub assault",
          summary: "An invented brawl outside a venue.",
        }),
      ],
      corpus,
  );
  assert.equal(kept.length, 0);
  assert.equal(dropped.length, 1);
});

test("minor claims pass without corroboration", () => {
  // Historical context is rarely in this week of headlines; requiring
  // corroboration would strip a long career for no safety gain.
  const {kept} = corroborate(
      [claim({severity: 1}), claim({severity: 2}), claim({severity: 3})],
      corpus,
  );
  assert.equal(kept.length, 3);
});

test("the threshold sits between severity 3 and 4", () => {
  const three = corroborate([claim({severity: 3})], corpus);
  const four = corroborate([claim({severity: 4})], corpus);
  assert.equal(three.kept.length, 1);
  assert.equal(four.kept.length, 0);
});

test("an empty corpus cannot corroborate anything serious", () => {
  const {kept, dropped} = corroborate([claim({severity: 5})], []);
  assert.equal(kept.length, 0);
  assert.equal(dropped.length, 1);
});

test("generic controversy vocabulary is not treated as evidence", () => {
  // Every claim contains the word "criticism"; matching on it proves
  // nothing about whether this particular claim is supported.
  const terms = distinctiveTerms("Public criticism and backlash controversy");
  for (const w of ["criticism", "backlash", "controversy", "public"]) {
    assert.ok(!terms.has(w), `"${w}" must not count as a distinctive term`);
  }
});

test("short words are not treated as evidence", () => {
  const terms = distinctiveTerms("He was in a row at the bar");
  for (const t of terms) assert.ok(t.length >= 4);
});

test("tolerates malformed input", () => {
  assert.deepEqual(corroborate(null, corpus).kept, []);
  assert.deepEqual(corroborate([null, "x", 7], corpus).kept, []);
  assert.equal(corroborate([claim({severity: 2})], null).kept.length, 1);
});
