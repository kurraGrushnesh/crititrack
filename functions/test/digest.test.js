"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildDigest,
  buildDigestPayload,
  figureLine,
  headlineFor,
} = require("../lib/digest");

/** A measured daily series, oldest first. */
function series(...scores) {
  return scores.map((score, i) => ({
    date: `2026-03-0${i + 1}`,
    score,
  }));
}

test("figureLine: reports the week's start-to-end change and direction", () => {
  const line = figureLine(
      {slug: "a-b", name: "A B"},
      series(50, 52, 55, 60, 64, 66, 70),
  );
  assert.equal(line.from, 50);
  assert.equal(line.to, 70);
  assert.equal(line.change, 20);
  assert.equal(line.direction, "up");
  assert.equal(line.measuredDays, 7);
});

test("figureLine: a small wobble is 'steady', not a mover", () => {
  const line = figureLine({slug: "x", name: "X"}, series(50, 51, 49, 52, 50));
  assert.equal(line.direction, "steady");
});

test("figureLine: withholds a change below the minimum measured days", () => {
  const line = figureLine({slug: "x", name: "X"}, series(50, 80));
  assert.equal(line.change, null);
  assert.equal(line.direction, "unknown");
});

test("figureLine: falls back to the slug when no name is given", () => {
  assert.equal(figureLine({slug: "n-t-rama-rao"}, []).name, "n-t-rama-rao");
});

test("buildDigest: ranks movers by absolute movement, unknowns last", () => {
  const digest = buildDigest([
    {figure: {slug: "small", name: "Small"}, history: series(50, 51, 52, 52, 53)},
    {figure: {slug: "big", name: "Big"}, history: series(50, 45, 40, 30, 20)},
    {figure: {slug: "new", name: "New"}, history: series(50, 60)},
  ]);
  assert.deepEqual(digest.lines.map((l) => l.slug), ["big", "small", "new"]);
  assert.deepEqual(digest.movers.map((l) => l.slug), ["big"]);
});

test("buildDigest: a genuinely quiet week has no headline", () => {
  const digest = buildDigest([
    {figure: {slug: "x", name: "X"}, history: series(50, 51, 50, 49, 50)},
  ]);
  assert.equal(digest.headline, null);
});

test("headlineFor: names the top mover, direction and count of others", () => {
  const movers = [
    {name: "Alice", slug: "alice", change: -12, direction: "down", to: 38},
    {name: "Bob", slug: "bob", change: 6, direction: "up", to: 61},
  ];
  const line = headlineFor(movers);
  assert.match(line, /^Alice is down 12 points this week, now 38\/100/);
  assert.match(line, /1 other moved too/);
});

test("headlineFor: singular vs plural for a single point and a single other", () => {
  assert.match(
      headlineFor([{name: "A", slug: "a", change: 1, direction: "up", to: 51}]),
      /up 1 point this week/,
  );
});

test("buildDigestPayload: every data value is a string, tag is fixed", () => {
  const p = buildDigestPayload({
    headline: "A is up 10 points this week, now 60/100.",
    moverCount: 3,
    topSlug: "a",
  });
  for (const v of Object.values(p.data)) assert.equal(typeof v, "string");
  assert.equal(p.data.kind, "digest");
  assert.equal(p.android.notification.tag, "weekly-digest");
});
