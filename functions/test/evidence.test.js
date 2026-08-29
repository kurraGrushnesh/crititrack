"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {linkEvidence, matchScore, normalise} = require("../lib/evidence");

const media = [
  {
    id: "n1",
    title: "Studio confirms lengthy legal dispute over creative control",
  },
  {id: "n2", title: "Charity gala raises record sum for hospital appeal"},
  {id: "y1", title: "Interview: reflecting on twenty years of touring"},
];

const frag = (fragment) => ({fragment, source: "news"});

// ── normalise ──────────────────────────────────────────────────────────

test("strips punctuation that would otherwise defeat containment", () => {
  // Smart quotes and trailing commas are the common case: the model
  // re-punctuates its own excerpt.
  assert.equal(normalise("“creative control,”"), "creative control");
  assert.equal(normalise("  Two   spaces  "), "two spaces");
});

test("survives being handed nothing", () => {
  assert.equal(normalise(null), "");
  assert.equal(normalise(undefined), "");
});

// ── matchScore ─────────────────────────────────────────────────────────

test("treats an excerpt contained in the headline as certain", () => {
  const m = matchScore("lengthy legal dispute", media[0].title);
  assert.equal(m.exact, true);
  assert.equal(m.score, 1);
});

test("scores a paraphrase by its share of distinctive terms", () => {
  // "legal" and "dispute" both land; "settled" does not.
  const m = matchScore("legal dispute settled", media[0].title);
  assert.equal(m.exact, false);
  assert.ok(m.score > 0.6 && m.score < 1);
});

test("scores an unrelated fragment at zero", () => {
  assert.equal(matchScore("hospital appeal total", media[0].title).score, 0);
});

test("refuses to score a fragment with too few distinctive terms", () => {
  // "he denied the claims" overlaps with almost any headline, so it must
  // not be allowed to match one.
  assert.equal(matchScore("he was not", media[0].title).score, 0);
});

// ── linkEvidence ───────────────────────────────────────────────────────

test("links an excerpt to the article it came from", () => {
  const [linked] = linkEvidence([frag("legal dispute over creative")], media);
  assert.equal(linked.mediaId, "n1");
});

test("keeps the original fragment and source untouched", () => {
  const [linked] = linkEvidence([frag("record sum for hospital")], media);
  assert.equal(linked.fragment, "record sum for hospital");
  assert.equal(linked.source, "news");
  assert.equal(linked.mediaId, "n2");
});

test("links to a video as readily as to an article", () => {
  const [linked] = linkEvidence([frag("twenty years of touring")], media);
  assert.equal(linked.mediaId, "y1");
});

test("returns null rather than guessing when nothing matches", () => {
  const [linked] = linkEvidence([frag("comments on tax affairs")], media);
  assert.equal(linked.mediaId, null);
});

test("returns null when two headlines share the excerpt as a prefix", () => {
  // Both contain it, but they are different stories. Picking the first
  // would attribute the quote to an article that never carried it.
  //
  // The case this appears to give up — two outlets running one
  // syndicated headline — is collapsed by `dedupe` upstream, so a tie
  // reaching here really does mean two different stories.
  const prefixed = [
    {id: "a", title: "Singer announces surprise European stadium tour"},
    {id: "b", title: "Singer announces surprise European album release"},
  ];
  const [linked] = linkEvidence(
      [frag("singer announces surprise european")],
      prefixed,
  );
  assert.equal(linked.mediaId, null);
});

test("links when one headline contains the excerpt and another does not", () => {
  const clear = [
    {id: "a", title: "Studio confirms lengthy legal dispute, sources say"},
    {id: "b", title: "Charity gala raises record sum"},
  ];
  const [linked] = linkEvidence(
      [frag("studio confirms lengthy legal dispute")],
      clear,
  );
  assert.equal(linked.mediaId, "a");
});

test("ignores items with no usable id or title", () => {
  const broken = [
    null,
    {id: "", title: "Studio confirms lengthy legal dispute"},
    {id: "ok", title: null},
    {id: "good", title: "Studio confirms lengthy legal dispute"},
  ];
  const [linked] = linkEvidence(
      [frag("studio confirms lengthy legal dispute")],
      broken,
  );
  assert.equal(linked.mediaId, "good");
});

test("drops fragments with no text and survives bad input", () => {
  assert.deepEqual(linkEvidence([{fragment: ""}], media), []);
  assert.deepEqual(linkEvidence(null, media), []);
  assert.deepEqual(linkEvidence(undefined, undefined), []);
  assert.equal(linkEvidence([frag("anything at all")], null)[0].mediaId, null);
});
