"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {parseGdelt, parseGdeltDate, dedupe} = require("../lib/media");

test("expands GDELT's compact timestamp to ISO 8601", () => {
  // Date.parse does not understand "20260828T164028Z".
  assert.equal(parseGdeltDate("20260828T164028Z"), "2026-08-28T16:40:28.000Z");
});

test("falls back to Date parsing for other timestamp shapes", () => {
  assert.equal(
      parseGdeltDate("2026-08-28T16:40:28Z"),
      "2026-08-28T16:40:28.000Z",
  );
});

test("returns null rather than an Invalid Date", () => {
  for (const v of [undefined, null, 42, "", "not a date", {}]) {
    assert.equal(parseGdeltDate(v), null);
  }
});

test("maps a GDELT article onto the shared media shape", () => {
  const [item] = parseGdelt({
    articles: [
      {
        url: "https://variety.com/story",
        title: "  A headline  ",
        domain: "variety.com",
        seendate: "20260828T164028Z",
        socialimage: "https://img/x.jpg",
      },
    ],
  });

  assert.equal(item.type, "news");
  assert.equal(item.title, "A headline", "title is trimmed");
  assert.equal(item.url, "https://variety.com/story");
  assert.equal(item.source, "variety.com");
  assert.equal(item.thumbnailUrl, "https://img/x.jpg");
  assert.equal(item.publishedAt, "2026-08-28T16:40:28.000Z");
  assert.ok(item.id, "needs a stable id for the Firestore document");
});

test("gives the same URL the same id across runs", () => {
  const one = parseGdelt({articles: [{url: "https://a.com/x", title: "T"}]});
  const two = parseGdelt({articles: [{url: "https://a.com/x", title: "T"}]});
  assert.equal(one[0].id, two[0].id);
});

test("drops articles missing a url or title", () => {
  const out = parseGdelt({
    articles: [
      {url: "https://a.com/x"},
      {title: "no url"},
      null,
      {url: "https://b.com/y", title: "Good"},
    ],
  });
  assert.equal(out.length, 1);
  assert.equal(out[0].title, "Good");
});

test("returns an empty array for a malformed response", () => {
  for (const v of [undefined, null, {}, {articles: "nope"}, {articles: null}]) {
    assert.deepEqual(parseGdelt(v), []);
  }
});

test("dedupe ignores tracking parameters on an otherwise identical URL", () => {
  const out = dedupe([
    {url: "https://a.com/x?utm_source=twitter", title: "One"},
    {url: "https://a.com/x", title: "Two"},
  ]);
  assert.equal(out.length, 1);
});

test("dedupe catches the same story syndicated under different URLs", () => {
  // Counting a syndicated story three times would skew the sentiment
  // aggregate toward whatever happened to be widely republished.
  const out = dedupe([
    {url: "https://a.com/1", title: "Star wins award!"},
    {url: "https://b.com/2", title: "Star Wins Award"},
    {url: "https://c.com/3", title: "star wins award."},
  ]);
  assert.equal(out.length, 1);
});

test("dedupe keeps genuinely different stories", () => {
  const out = dedupe([
    {url: "https://a.com/1", title: "Star wins award"},
    {url: "https://b.com/2", title: "Star announces tour"},
  ]);
  assert.equal(out.length, 2);
});

test("dedupe preserves order, so the first source listed wins", () => {
  const out = dedupe([
    {url: "https://gdelt.example/1", title: "Same story", source: "gdelt"},
    {url: "https://newsapi.example/2", title: "Same story", source: "newsapi"},
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].source, "gdelt");
});

test("dedupe tolerates items with no url or title", () => {
  const out = dedupe([{}, {url: ""}, {title: ""}]);
  assert.equal(out.length, 3, "nothing to compare means nothing to drop");
});
