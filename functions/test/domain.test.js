"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const domain = require("../lib/sentiment/domain");
const lexicon = require("../lib/sentiment/lexicon");

test("abstains on a headline with no reputational vocabulary", () => {
  // Most headlines about most people. Returning 50 would assert a
  // neutrality this method has no basis for, and would drag every score
  // toward the middle in proportion to how ordinary the coverage was.
  assert.equal(domain.score("Singer announces European tour dates"), null);
  assert.equal(domain.score("Actor spotted at airport"), null);
});

test("survives empty and non-string input", () => {
  for (const v of ["", "   ", null, undefined, 42, {}]) {
    assert.equal(domain.score(v), null);
  }
});

test("scores an allegation below neutral and a conviction lower still", () => {
  const accused = domain.score("Actor accused of misconduct by former colleague");
  const convicted = domain.score("Actor found guilty on all counts");

  assert.ok(accused < 50, `expected below 50, got ${accused}`);
  assert.ok(convicted < accused, "a conviction must read worse than a claim");
});

test("scores vindication above neutral", () => {
  assert.ok(domain.score("Star acquitted after two-week trial") > 50);
  assert.ok(domain.score("Charges dropped against the singer") > 50);
});

test("disagrees with the general-purpose lexicon on a resolution", () => {
  // This is the case the method exists for. VADER measures emotional
  // valence and sees "charges" and "investigation"; this measures
  // reputational direction and sees "cleared". The disagreement is what
  // the confidence band is built from, so it is asserted rather than
  // assumed.
  const headline = "Cleared of all charges after two-year investigation";

  const general = lexicon.scoreText(headline);
  const reputational = domain.score(headline);

  assert.ok(reputational > 50, "the subject was vindicated");
  assert.ok(
      general < reputational,
      `expected general (${general}) below reputational (${reputational})`,
  );
});

test("matches the longest phrase, not a word inside it", () => {
  // "charges dropped" is good news; "charged with" is not. Matching the
  // shorter term first would invert the sign.
  assert.ok(domain.score("Charges dropped") > 50);
  assert.ok(domain.score("Charged with fraud") < 50);
});

test("reads a negated phrase as its own term", () => {
  assert.ok(domain.score("Jury returns not guilty verdict") > 50);
  assert.ok(domain.score("Found guilty by jury") < 50);
});

test("is unaffected by casing and punctuation", () => {
  const plain = domain.score("Star acquitted after trial");
  const messy = domain.score("STAR — ACQUITTED!! after trial…");
  assert.equal(plain, messy);
});

test("averages rather than sums, so verbosity does not decide the score", () => {
  // Three mild criticisms are not worse than one conviction.
  const mild = domain.score("Criticised, slammed and facing backlash");
  const severe = domain.score("Found guilty");

  assert.ok(mild < 50);
  assert.ok(severe < mild, `expected ${severe} below ${mild}`);
});

test("never claims the extremes of the scale", () => {
  // Matching keywords is not grounds for asserting 0 or 100.
  const worst = domain.score("Found guilty of sexual assault and fraud");
  const best = domain.score("Exonerated and honoured with lifetime achievement");

  assert.ok(worst > 0, `expected above 0, got ${worst}`);
  assert.ok(best < 100, `expected below 100, got ${best}`);
});

test("scoreAll stays aligned with its input, nulls included", () => {
  // blendItem indexes into this alongside the other methods, so a
  // dropped entry would silently pair one headline's score with another
  // headline's text.
  const texts = ["Actor acquitted", "Singer announces tour", "Star convicted"];
  const scores = domain.scoreAll(texts);

  assert.equal(scores.length, texts.length);
  assert.ok(scores[0] > 50);
  assert.equal(scores[1], null);
  assert.ok(scores[2] < 50);
});

test("scoreAll survives bad input", () => {
  assert.deepEqual(domain.scoreAll(null), []);
  assert.deepEqual(domain.scoreAll(undefined), []);
  assert.deepEqual(domain.scoreAll([null, ""]), [null, null]);
});
