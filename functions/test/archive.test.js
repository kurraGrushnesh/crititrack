"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {archiveUrl, annotateArchiveLinks} = require("../lib/archive");

test("wraps a safe https URL in a Wayback latest-capture link", () => {
  assert.equal(
      archiveUrl("https://www.reuters.com/world/story-2026"),
      "https://web.archive.org/web/2/https://www.reuters.com/world/story-2026",
  );
});

test("returns null for an unsafe or malformed original", () => {
  for (const v of [
    "http://insecure.example/story",
    "javascript:alert(1)",
    "https://user:pass@evil.example/",
    "not a url",
    "",
    null,
    42,
  ]) {
    assert.equal(archiveUrl(v), null);
  }
});

test("annotateArchiveLinks tags each item and mutates in place", () => {
  const items = [
    {url: "https://apnews.com/a"},
    {url: "http://nope.example/b"},
    {},
  ];
  const out = annotateArchiveLinks(items);
  assert.equal(out, items);
  assert.equal(items[0].archiveUrl, "https://web.archive.org/web/2/https://apnews.com/a");
  assert.equal(items[1].archiveUrl, null);
  assert.equal(items[2].archiveUrl, null);
});

test("annotateArchiveLinks tolerates a non-array", () => {
  assert.doesNotThrow(() => annotateArchiveLinks(null));
});
