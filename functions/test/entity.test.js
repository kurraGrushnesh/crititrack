"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  extractFacts,
  isHuman,
  resolutionConfidence,
  sitelinkCount,
  careerEntries,
  buildCareer,
  PROPS,
  HUMAN,
  INSTANCE_OF,
} = require("../lib/entity");

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

// ── Expanded record (awards, works, education, links) ───────────────

const claimId = (id, qualifiers) => ({
  mainsnak: {datavalue: {value: {id}}},
  ...(qualifiers ? {qualifiers} : {}),
});
const yearQual = (y) => ({
  P585: [{datavalue: {value: {time: `+${y}-00-00T00:00:00Z`}}}],
});
const claimStr = (v) => ({mainsnak: {datavalue: {value: v}}});

test("awards keep the year from their point-in-time qualifier", () => {
  const e = {claims: {P166: [claimId("Q1", yearQual(2021))]}};
  assert.deepEqual(extractFacts(e).awards, [{id: "Q1", year: 2021}]);
});

test("an award with no date is kept, with a null year", () => {
  const e = {claims: {P166: [claimId("Q1")]}};
  assert.deepEqual(extractFacts(e).awards, [{id: "Q1", year: null}]);
});

test("deprecated awards are dropped like any other claim", () => {
  const e = {
    claims: {P166: [{...claimId("Q1"), rank: "deprecated"}, claimId("Q2")]},
  };
  assert.deepEqual(extractFacts(e).awards.map((a) => a.id), ["Q2"]);
});

test("notable work, education and birthplace are read off the entity", () => {
  const e = {
    claims: {
      P800: [claimId("Q10"), claimId("Q11")],
      P69: [claimId("Q20")],
      P19: [claimId("Q30")],
    },
  };
  const f = extractFacts(e);
  assert.deepEqual(f.notableWorkIds, ["Q10", "Q11"]);
  assert.deepEqual(f.educationIds, ["Q20"]);
  assert.equal(f.birthPlaceId, "Q30");
});

test("birthPlaceId is null rather than undefined when absent", () => {
  assert.equal(extractFacts({claims: {}}).birthPlaceId, null);
});

test("field of work (P101) is read and capped at six", () => {
  const e = {
    claims: {
      P101: Array.from({length: 9}, (_, i) => claimId(`Q${100 + i}`)),
    },
  };
  assert.deepEqual(extractFacts(e).fieldOfWorkIds, [
    "Q100", "Q101", "Q102", "Q103", "Q104", "Q105",
  ]);
  assert.deepEqual(extractFacts({claims: {}}).fieldOfWorkIds, []);
});

test("external identifiers become URLs", () => {
  const e = {
    claims: {
      P345: [claimStr("nm3918035")],
      P2002: [claimStr("zendaya")],
      P2003: [claimStr("zendaya")],
      P856: [claimStr("https://example.com")],
    },
  };
  const links = extractFacts(e).links;
  assert.equal(links.imdb, "https://www.imdb.com/name/nm3918035/");
  assert.equal(links.x, "https://x.com/zendaya");
  assert.equal(links.instagram, "https://www.instagram.com/zendaya/");
  assert.equal(links.website, "https://example.com");
});

test("the wider social set becomes URLs, each validated per platform", () => {
  const e = {
    claims: {
      P2397: [claimStr("UC" + "a".repeat(22))],
      P2013: [claimStr("official.page")],
      P7085: [claimStr("the.star")],
      P6634: [claimStr("jane-doe-123")],
      P17427: [claimStr("thestar")],
      P12361: [claimStr("star.bsky.social")],
      P4033: [claimStr("star@mastodon.social")],
    },
  };
  const links = extractFacts(e).links;
  assert.equal(links.youtube, "https://www.youtube.com/channel/UC" + "a".repeat(22));
  assert.equal(links.facebook, "https://www.facebook.com/official.page");
  assert.equal(links.tiktok, "https://www.tiktok.com/@the.star");
  assert.equal(links.linkedin, "https://www.linkedin.com/in/jane-doe-123");
  assert.equal(links.threads, "https://www.threads.net/@thestar");
  assert.equal(links.bluesky, "https://bsky.app/profile/star.bsky.social");
  assert.equal(links.mastodon, "https://mastodon.social/@star");
});

test("a malformed YouTube channel id or bare Bluesky handle is dropped", () => {
  const e = {
    claims: {
      P2397: [claimStr("HC123")], // not a UC-prefixed 24-char id
      P12361: [claimStr("nodothandle")], // no domain part
      P4033: [claimStr("notmastodon")], // no user@instance
    },
  };
  const links = extractFacts(e).links;
  assert.equal(links.youtube, undefined);
  assert.equal(links.bluesky, undefined);
  assert.equal(links.mastodon, undefined);
});

test("an IMDb title id on a person is rejected, not linked to a film", () => {
  const e = {claims: {P345: [claimStr("tt1234567")]}};
  assert.equal(extractFacts(e).links.imdb, undefined);
});

test("a handle that cannot be one is dropped rather than linked", () => {
  const e = {
    claims: {
      P2002: [claimStr("way too long for a handle")],
      P856: [claimStr("javascript:alert(1)")],
    },
  };
  const links = extractFacts(e).links;
  assert.equal(links.x, undefined);
  // Only http(s) is linkable; anything else would be a live XSS vector
  // rendered as the subject's own website.
  assert.equal(links.website, undefined);
});

test("the expanded fields are empty, not missing, on a bare entity", () => {
  const f = extractFacts({});
  assert.deepEqual(f.awards, []);
  assert.deepEqual(f.notableWorkIds, []);
  assert.deepEqual(f.educationIds, []);
  assert.deepEqual(f.links, {});
});

// ── resolution confidence ──────────────────────────────────────────────

/**
 * A minimal described entity for the confidence classifier.
 * @param {{label: string, aliases?: string[], sitelinks?: number,
 *   description?: string}} o
 */
function described(o) {
  return {
    hit: {id: "Q1", label: o.label, description: o.description || ""},
    entity: {
      labels: {en: {value: o.label}},
      descriptions: o.description ? {en: {value: o.description}} : {},
      aliases: {en: (o.aliases || []).map((v) => ({value: v}))},
      sitelinks: Object.fromEntries(
          Array.from({length: o.sitelinks || 0}, (_, i) => [`w${i}`, {}]),
      ),
    },
  };
}

test("sitelinkCount counts language editions, 0 when absent", () => {
  assert.equal(sitelinkCount({sitelinks: {enwiki: {}, dewiki: {}}}), 2);
  assert.equal(sitelinkCount({}), 0);
  assert.equal(sitelinkCount(null), 0);
});

test("one well-documented exact-name match is high confidence", () => {
  const best = described({label: "Zendaya", sitelinks: 90});
  assert.equal(resolutionConfidence("Zendaya", best, [best]), "high");
});

test("two notable people who share the queried name are ambiguous", () => {
  // "Michael Jordan" — the basketball player and the AI professor both
  // carry the name and both have many Wikipedia editions.
  const athlete = described({label: "Michael Jordan", sitelinks: 90});
  const professor = described({
    label: "Michael I. Jordan",
    aliases: ["Michael Jordan"],
    sitelinks: 20,
  });
  assert.equal(
      resolutionConfidence("Michael Jordan", athlete, [athlete, professor]),
      "ambiguous",
  );
});

test("a minor same-named person pulls a strong match down to medium", () => {
  const star = described({label: "Chris Evans", sitelinks: 70});
  const other = described({label: "Chris Evans", sitelinks: 2});
  assert.equal(
      resolutionConfidence("Chris Evans", star, [star, other]),
      "medium",
  );
});

test("a strong same-named person makes it ambiguous", () => {
  const actor = described({label: "Chris Evans", sitelinks: 70});
  const presenter = described({label: "Chris Evans", sitelinks: 14});
  assert.equal(
      resolutionConfidence("Chris Evans", actor, [actor, presenter]),
      "ambiguous",
  );
});

test("a thinly-documented top match is low confidence", () => {
  const obscure = described({label: "Jane Q Public", sitelinks: 1});
  assert.equal(
      resolutionConfidence("Jane Q Public", obscure, [obscure]),
      "low",
  );
});

// ── career timeline ────────────────────────────────────────────────────

/** A P39 / P108 claim with start/end and org qualifiers. */
function post(roleId, { org, of, start, end } = {}) {
  const q = {};
  if (org) q[PROPS.employer] = [{ datavalue: { value: { id: org } } }];
  if (of) q.P642 = [{ datavalue: { value: { id: of } } }];
  if (start) q.P580 = [{ datavalue: { value: { time: `+${start}-00-00T00:00:00Z` } } }];
  if (end) q.P582 = [{ datavalue: { value: { time: `+${end}-00-00T00:00:00Z` } } }];
  return { mainsnak: { datavalue: { value: { id: roleId } } }, qualifiers: q };
}
function job(orgId, { start, end } = {}) {
  const q = {};
  if (start) q.P580 = [{ datavalue: { value: { time: `+${start}-00-00T00:00:00Z` } } }];
  if (end) q.P582 = [{ datavalue: { value: { time: `+${end}-00-00T00:00:00Z` } } }];
  return { mainsnak: { datavalue: { value: { id: orgId } } }, qualifiers: q };
}

test("careerEntries reads dated positions and employments", () => {
  const e = {
    claims: {
      P39: [post("Q1", { of: "Q10", start: 2015, end: 2019 })],
      P108: [job("Q20", { start: 2019 })],
    },
  };
  const rows = careerEntries(e);
  assert.deepEqual(rows, [
    { roleId: "Q1", orgId: "Q10", locationId: null, start: 2015, end: 2019 },
    { roleId: null, orgId: "Q20", locationId: null, start: 2019, end: null },
  ]);
});

test("careerEntries drops an undated employer with no role", () => {
  const e = { claims: { P108: [job("Q20")] } };
  assert.deepEqual(careerEntries(e), []);
});

test("careerEntries does not double-count an employer already held as a post", () => {
  const e = {
    claims: {
      P39: [post("Q1", { of: "Q10", start: 2015 })],
      P108: [job("Q10", { start: 2015 })],
    },
  };
  assert.equal(careerEntries(e).length, 1);
});

test("buildCareer resolves labels, orders oldest-first, tags a source", () => {
  const rows = [
    { roleId: "Q1", orgId: "Q10", start: 2021, end: null },
    { roleId: "Q2", orgId: "Q11", start: 2016, end: 2021 },
  ];
  const labels = { Q1: "Chief Executive Officer", Q2: "Engineer", Q10: "Company Z", Q11: "Company Y" };
  const career = buildCareer(rows, labels, "Q42");
  assert.deepEqual(career.map((c) => c.start), [2016, 2021]);
  assert.equal(career[0].role, "Engineer");
  assert.equal(career[0].organization, "Company Y");
  assert.equal(career[0].location, null);
  assert.deepEqual(career[0].source, {
    name: "Wikidata",
    url: "https://www.wikidata.org/wiki/Q42",
  });
});

test("buildCareer drops a row whose role and organisation both fail to resolve", () => {
  const career = buildCareer(
      [{ roleId: "Q99", orgId: "Q98", start: 2000, end: null }],
      {},
      "Q42",
  );
  assert.deepEqual(career, []);
});

test("extractFacts exposes an empty career array on a bare entity", () => {
  assert.deepEqual(extractFacts({}).career, []);
});

test("similar names alone never trigger ambiguity", () => {
  // Same profession, same country, near-identical spelling — but the
  // second person's name does not actually match the query.
  const best = described({label: "Ronaldo", sitelinks: 80});
  const nazario = described({label: "Ronaldo Nazário", sitelinks: 60});
  assert.equal(
      resolutionConfidence("Ronaldo", best, [best, nazario]),
      "high",
  );
});
