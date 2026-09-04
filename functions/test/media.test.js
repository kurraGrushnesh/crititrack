"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  parseGdelt,
  parseGdeltDate,
  parseReddit,
  classifyTopic,
  dedupe,
} = require("../lib/media");

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

// ── Reddit ─────────────────────────────────────────────────────────

test("maps a Reddit thread onto the shared media shape", () => {
  const [item] = parseReddit({
    data: {
      children: [
        {
          data: {
            title: "  Thoughts on the new interview?  ",
            permalink: "/r/movies/comments/abc/thoughts/",
            subreddit_name_prefixed: "r/movies",
            subreddit: "movies",
            created_utc: 1_700_000_000,
            score: 240,
            num_comments: 88,
            thumbnail: "https://b.thumbs.redditmedia.com/x.jpg",
            over_18: false,
          },
        },
      ],
    },
  });

  assert.equal(item.type, "reddit");
  assert.equal(item.title, "Thoughts on the new interview?");
  assert.equal(item.url, "https://www.reddit.com/r/movies/comments/abc/thoughts/");
  assert.equal(item.source, "r/movies");
  assert.equal(item.publishedAt, "2023-11-14T22:13:20.000Z");
  assert.equal(item.commentCount, 88);
});

test("drops NSFW threads and rows missing a title or permalink", () => {
  const out = parseReddit({
    data: {
      children: [
        {data: {title: "ok", permalink: "/r/x/1/", over_18: true}},
        {data: {title: "no link"}},
        {data: {permalink: "/r/x/2/"}},
      ],
    },
  });
  assert.equal(out.length, 0);
});

test("parseReddit returns [] for a malformed listing", () => {
  for (const v of [null, {}, {data: {}}, {data: {children: "nope"}}]) {
    assert.deepEqual(parseReddit(v), []);
  }
});

// ── topic classification ───────────────────────────────────────────

test("classifyTopic picks the topic from title/description keywords", () => {
  assert.equal(classifyTopic({title: "Star sued for defamation over remarks"}), "legal");
  assert.equal(classifyTopic({title: "Company earnings miss; shares fall"}), "financial");
  assert.equal(classifyTopic({title: "Senator endorses the candidate"}), "political");
  assert.equal(classifyTopic({title: "Couple confirm divorce after ten years"}), "personal");
  assert.equal(classifyTopic({title: "New album announced, world tour to follow"}), "professional");
});

test("classifyTopic resolves legal before financial for a mixed headline", () => {
  assert.equal(
      classifyTopic({title: "Executive charged in tax fraud lawsuit"}),
      "legal",
  );
});

test("classifyTopic falls back to 'other' rather than guessing", () => {
  assert.equal(classifyTopic({title: "A quiet week for the star"}), "other");
  assert.equal(classifyTopic({}), "other");
});
