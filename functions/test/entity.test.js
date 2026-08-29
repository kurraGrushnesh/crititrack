"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {extractFacts, isHuman, PROPS, HUMAN, INSTANCE_OF} =
  require("../lib/entity");

/** A Wikidata time claim. */
function time(value, precision) {
  return [{mainsnak: {datavalue: {value: {time: value, precision}}}}];
}

/** Wikidata entity-valued claims. */
function ids(list) {
  return list.map((id) =>
    typeof id === "string" ?
      {mainsnak: {datavalue: {value: {id}}}} :
      {rank: id.rank, mainsnak: {datavalue: {value: {id: id.id}}}},
  );
}

const person = {
  claims: {
    [INSTANCE_OF]: ids([HUMAN]),
    [PROPS.birthDate]: time("+1996-09-01T00:00:00Z", 11),
    [PROPS.citizenship]: ids(["Q30"]),
    [PROPS.occupation]: ids(["Q33999", "Q177220"]),
  },
};

// ── isHuman ────────────────────────────────────────────────────────────

test("recognises a human and rejects everything else", () => {
  // The scope rule from the editorial policy is enforced here rather than
  // merely stated: a search for "Zendaya" returns the given name first
  // and the album third.
  assert.equal(isHuman(person), true);
  assert.equal(isHuman({claims: {[INSTANCE_OF]: ids(["Q482994"])}}), false);
  assert.equal(isHuman({claims: {}}), false);
  assert.equal(isHuman({}), false);
});

// ── dates ──────────────────────────────────────────────────────────────

test("keeps a full date when Wikidata asserts day precision", () => {
  assert.equal(extractFacts(person).birthDate, "1996-09-01");
});

test("does not invent a birthday from a year-precision date", () => {
  // Wikidata pads unknown components with zeroes:
  // "+1856-00-00T00:00:00Z" at precision 9 means "1856, month and day
  // unknown". Rendering that as 1 January would state a birthday nobody
  // recorded.
  const yearOnly = {claims: {[PROPS.birthDate]: time("+1856-00-00T00:00:00Z", 9)}};
  assert.equal(extractFacts(yearOnly).birthDate, "1856");
});

test("keeps year and month at month precision", () => {
  const monthly = {
    claims: {[PROPS.birthDate]: time("+1912-06-00T00:00:00Z", 10)},
  };
  assert.equal(extractFacts(monthly).birthDate, "1912-06");
});

test("truncates a full date whose precision does not support it", () => {
  // The components are present but Wikidata does not vouch for them.
  const loose = {
    claims: {[PROPS.birthDate]: time("+1912-06-15T00:00:00Z", 9)},
  };
  assert.equal(extractFacts(loose).birthDate, "1912");
});

test("drops a BCE date rather than rendering it", () => {
  const bce = {claims: {[PROPS.birthDate]: time("-0044-03-15T00:00:00Z", 11)}};
  assert.equal(extractFacts(bce).birthDate, null);
});

test("reads a death date the same way", () => {
  const dead = {
    claims: {[PROPS.deathDate]: time("+2016-01-10T00:00:00Z", 11)},
  };
  assert.equal(extractFacts(dead).deathDate, "2016-01-10");
});

test("returns null for a missing or malformed date", () => {
  assert.equal(extractFacts({}).birthDate, null);
  assert.equal(extractFacts({claims: {}}).deathDate, null);
  assert.equal(
      extractFacts({claims: {[PROPS.birthDate]: [{}]}}).birthDate,
      null,
  );
  assert.equal(
      extractFacts({claims: {[PROPS.birthDate]: time("rubbish", 11)}}).birthDate,
      null,
  );
});

// ── entity-valued claims ───────────────────────────────────────────────

test("reads citizenship and occupation ids in order", () => {
  const facts = extractFacts(person);
  assert.deepEqual(facts.citizenshipIds, ["Q30"]);
  assert.deepEqual(facts.occupationIds, ["Q33999", "Q177220"]);
});

test("caps occupations, because Wikidata often lists a dozen", () => {
  const many = {
    claims: {
      [PROPS.occupation]: ids(["Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q7"]),
    },
  };
  assert.equal(extractFacts(many).occupationIds.length, 4);
});

test("caps citizenship at two", () => {
  const dual = {claims: {[PROPS.citizenship]: ids(["Q1", "Q2", "Q3"])}};
  assert.deepEqual(extractFacts(dual).citizenshipIds, ["Q1", "Q2"]);
});

test("skips a claim Wikidata has marked deprecated", () => {
  // Deprecated means the community has recorded it as wrong. Showing it
  // as a fact on a profile is the opposite of what the rank means.
  const withBad = {
    claims: {
      [PROPS.occupation]: ids([{id: "Q1", rank: "deprecated"}, "Q2"]),
    },
  };
  assert.deepEqual(extractFacts(withBad).occupationIds, ["Q2"]);
});

test("ignores a claim whose value is not an item id", () => {
  const broken = {
    claims: {
      [PROPS.occupation]: [
        {mainsnak: {datavalue: {value: {id: "notaqid"}}}},
        {mainsnak: {}},
        {},
        {mainsnak: {datavalue: {value: {id: "Q9"}}}},
      ],
    },
  };
  assert.deepEqual(extractFacts(broken).occupationIds, ["Q9"]);
});

test("returns empty bundles for an entity with no claims", () => {
  const facts = extractFacts({});
  assert.equal(facts.birthDate, null);
  assert.equal(facts.deathDate, null);
  assert.deepEqual(facts.citizenshipIds, []);
  assert.deepEqual(facts.occupationIds, []);
});

// ── resolveByQid guard ─────────────────────────────────────────────────

test("resolveByQid rejects anything that is not a Wikidata id", async () => {
  // It arrives in a query string, so it is validated rather than trusted.
  // These all return before any network call is made.
  const {resolveByQid} = require("../lib/entity");

  for (const bad of ["", "  ", "P31", "Q", "Qabc", "42", "Q1; DROP", null]) {
    assert.equal(await resolveByQid(bad), null);
  }
});
