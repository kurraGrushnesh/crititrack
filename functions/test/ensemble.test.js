"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  blendItem,
  aggregate,
  confidenceLabel,
} = require("../lib/sentiment/ensemble");
const {weightFor, hostOf} = require("../lib/sentiment/reach");
const lexicon = require("../lib/sentiment/lexicon");

// ── lexicon ────────────────────────────────────────────────────────

test("lexicon separates praise, neutrality and damage", () => {
  const good = lexicon.scoreText("Star wins award, fans delighted");
  const flat = lexicon.scoreText("Actor attends premiere");
  const bad = lexicon.scoreText("Actor faces fraud charges");
  assert.ok(good > 65, `expected positive, got ${good}`);
  assert.ok(bad < 40, `expected negative, got ${bad}`);
  assert.ok(flat > 40 && flat < 65, `expected neutral, got ${flat}`);
});

test("lexicon returns null when there is nothing to score", () => {
  for (const v of ["", "   ", null, undefined, 42]) {
    assert.equal(lexicon.scoreText(v), null);
  }
});

test("lexicon preserves positions so methods stay aligned", () => {
  const out = lexicon.scoreAll(["Great news", "", "Terrible scandal"]);
  assert.equal(out.length, 3);
  assert.equal(out[1], null, "a gap must stay a gap, not shift the rest");
});

// ── blending ───────────────────────────────────────────────────────

test("blend averages the members and reports their spread", () => {
  const b = blendItem({lexicon: 80, domain: 82, llm: 78});
  assert.ok(b.score > 78 && b.score < 82);
  assert.equal(b.spread, 4);
  assert.equal(b.methods.length, 3);
});

test("blend renormalises when a member is missing", () => {
  // With only the lexicon present its weight must become 1, not stay at
  // 0.2 and drag the score toward zero.
  const b = blendItem({lexicon: 70});
  assert.equal(b.score, 70);
  assert.equal(b.spread, 0);
});

test("blend ignores non-numeric member scores", () => {
  const b = blendItem({lexicon: 70, llm: null, domain: NaN});
  assert.deepEqual(b.methods, ["lexicon"]);
});

test("blend returns null when no member produced a score", () => {
  assert.equal(blendItem({}), null);
  assert.equal(blendItem({lexicon: null, llm: undefined}), null);
});

// ── aggregation and confidence ─────────────────────────────────────

const agreeing = (n) =>
  Array.from({length: n}, () => ({
    score: 78,
    spread: 2,
    methods: ["lexicon", "domain", "llm"],
  }));

test("many agreeing items give a tight, high-confidence band", () => {
  const r = aggregate(agreeing(30));
  assert.ok(r.confidence > 0.8, `confidence was ${r.confidence}`);
  assert.ok(r.high - r.low < 8, "band should be narrow");
  assert.equal(r.sampleSize, 30);
});

test("few conflicting items give a wide, low-confidence band", () => {
  const r = aggregate([
    {score: 55, spread: 45, methods: ["lexicon"]},
    {score: 55, spread: 45, methods: ["lexicon"]},
  ]);
  assert.ok(r.confidence < 0.3, `confidence was ${r.confidence}`);
  assert.ok(r.high - r.low > 25, "band should be wide");
});

test("disagreement lowers confidence even with plenty of evidence", () => {
  const calm = aggregate(agreeing(30)).confidence;
  const noisy = aggregate(agreeing(30).map((i) => ({...i, spread: 40})))
      .confidence;
  assert.ok(noisy < calm, "spread must reduce confidence");
});

test("the band never leaves 0-100", () => {
  const low = aggregate([{score: 2, spread: 50, methods: ["lexicon"]}]);
  const high = aggregate([{score: 99, spread: 50, methods: ["lexicon"]}]);
  assert.ok(low.low >= 0);
  assert.ok(high.high <= 100);
});

test("no usable items yields neutral with zero confidence", () => {
  const r = aggregate([]);
  assert.equal(r.score, 50);
  assert.equal(r.confidence, 0);
  assert.equal(r.sampleSize, 0);
});

test("reach weighting shifts the aggregate toward the wider-read item", () => {
  const flat = aggregate([
    {score: 20, spread: 0, methods: ["llm"]},
    {score: 80, spread: 0, methods: ["llm"]},
  ]);
  const weighted = aggregate([
    {score: 20, spread: 0, methods: ["llm"], weight: 1},
    {score: 80, spread: 0, methods: ["llm"], weight: 3},
  ]);
  assert.ok(
      weighted.score > flat.score,
      "the higher-reach item must pull the score toward itself",
  );
});

test("confidence labels are ordered", () => {
  assert.equal(confidenceLabel(0.9), "High confidence");
  assert.equal(confidenceLabel(0.6), "Moderate confidence");
  assert.equal(confidenceLabel(0.35), "Low confidence");
  assert.equal(confidenceLabel(0.1), "Very low confidence");
});

// ── reach ──────────────────────────────────────────────────────────

test("a major outlet outweighs an unknown one", () => {
  assert.ok(
      weightFor({type: "news", source: "reuters.com"}) >
      weightFor({type: "news", source: "randomblog.xyz"}),
  );
});

test("one outlet gets one weight whichever source surfaced it", () => {
  // GDELT reports a domain, NewsAPI a display name.
  assert.equal(
      weightFor({type: "news", source: "theguardian.com"}),
      weightFor({type: "news", source: "The Guardian"}),
  );
});

test("view counts scale sub-linearly and stay capped", () => {
  const small = weightFor({type: "youtube", viewCount: 100});
  const big = weightFor({type: "youtube", viewCount: 1000000});
  const huge = weightFor({type: "youtube", viewCount: 999999999});
  assert.ok(big > small);
  assert.ok(huge <= 3.0, "one viral item must not swamp everything else");
});

test("missing or nonsense reach data falls back to a neutral weight", () => {
  for (const v of [undefined, null, -5, "abc", 0]) {
    assert.equal(weightFor({type: "youtube", viewCount: v}), 1.0);
  }
  assert.equal(weightFor(null), 1.0);
  assert.equal(weightFor({type: "unknown"}), 1.0);
});

test("a routinely-unreliable tabloid is weighted below an unknown blog", () => {
  assert.ok(
      weightFor({type: "news", source: "dailymail.co.uk"}) <
      weightFor({type: "news", source: "randomblog.xyz"}),
  );
  assert.ok(
      weightFor({type: "news", source: "tmz.com"}) <
      weightFor({type: "news", source: "reuters.com"}),
  );
});

test("a Reddit thread never outweighs a plain news item", () => {
  const viral = weightFor({type: "reddit", commentCount: 5000});
  const quiet = weightFor({type: "reddit", commentCount: 0});
  assert.ok(viral > quiet, "engagement earns a little weight back");
  assert.ok(
      viral <= weightFor({type: "news", source: "randomblog.xyz"}),
      "discussion must not outweigh reporting",
  );
});

test("hostOf normalises URLs and bare domains alike", () => {
  assert.equal(hostOf("https://www.bbc.co.uk/news"), "bbc.co.uk");
  assert.equal(hostOf("WWW.Variety.com"), "variety.com");
  assert.equal(hostOf("not a domain"), "");
});

// ── tagFor: the band shown on a card in the feed ───────────────────────

test("tagFor bands a score at the documented thresholds", () => {
  const {tagFor, POSITIVE_AT, NEGATIVE_BELOW} = require("../lib/sentiment/ensemble");

  assert.equal(tagFor(POSITIVE_AT), "positive");
  assert.equal(tagFor(POSITIVE_AT - 0.1), "neutral");
  assert.equal(tagFor(NEGATIVE_BELOW), "neutral");
  assert.equal(tagFor(NEGATIVE_BELOW - 0.1), "negative");
  assert.equal(tagFor(0), "negative");
  assert.equal(tagFor(100), "positive");
});

test("tagFor returns null for a score that is not a number", () => {
  // A card with no tag renders without a chip; a card tagged "neutral"
  // asserts something we did not measure.
  const {tagFor} = require("../lib/sentiment/ensemble");

  assert.equal(tagFor(null), null);
  assert.equal(tagFor(undefined), null);
  assert.equal(tagFor("70"), null);
  assert.equal(tagFor(NaN), null);
});
