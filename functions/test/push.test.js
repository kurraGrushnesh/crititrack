"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isQuietNow,
  localMinutes,
  selectRecipients,
  buildPushPayload,
  chunkTokens,
  deadTokensFrom,
  MULTICAST_LIMIT,
} = require("../lib/push");

/** A UTC instant at a chosen hour and minute, on a fixed date. */
function utcAt(hour, minute = 0) {
  return Date.UTC(2026, 0, 15, hour, minute);
}

/** A device with a 22:00–07:00 quiet window, at UTC, watching one figure. */
function device(overrides = {}) {
  return {
    token: "tok-a",
    slugs: ["taylor-swift"],
    quietEnabled: true,
    quietStartMin: 22 * 60,
    quietEndMin: 7 * 60,
    utcOffsetMinutes: 0,
    ...overrides,
  };
}

// ── localMinutes ───────────────────────────────────────────────────────

test("converts UTC to local minutes for an eastern offset", () => {
  // 18:30 UTC in IST (+5:30) is exactly midnight.
  assert.equal(localMinutes(utcAt(18, 30), 330), 0);
});

test("stays positive for a western offset that crosses back over midnight", () => {
  // 02:00 UTC in PST (-8) is 18:00 the previous day. A single `%` would
  // yield -360 here and match no window at all.
  assert.equal(localMinutes(utcAt(2), -480), 18 * 60);
});

test("wraps a whole day without drifting", () => {
  assert.equal(localMinutes(utcAt(12), 720), 0);
  assert.equal(localMinutes(utcAt(0), 0), 0);
});

// ── isQuietNow ─────────────────────────────────────────────────────────

test("is quiet inside a window that wraps past midnight", () => {
  assert.equal(isQuietNow(device(), utcAt(23)), true);
  assert.equal(isQuietNow(device(), utcAt(1)), true);
});

test("is not quiet outside that window", () => {
  assert.equal(isQuietNow(device(), utcAt(18)), false);
  assert.equal(isQuietNow(device(), utcAt(12)), false);
});

test("includes the start minute and excludes the end minute", () => {
  // Half-open, so a 22:00–07:00 window and an 07:00–22:00 window tile the
  // day exactly once rather than overlapping at the seam.
  assert.equal(isQuietNow(device(), utcAt(22, 0)), true);
  assert.equal(isQuietNow(device(), utcAt(7, 0)), false);
  assert.equal(isQuietNow(device(), utcAt(6, 59)), true);
});

test("handles a same-day window that does not wrap", () => {
  const d = device({quietStartMin: 9 * 60, quietEndMin: 17 * 60});
  assert.equal(isQuietNow(d, utcAt(12)), true);
  assert.equal(isQuietNow(d, utcAt(8)), false);
  assert.equal(isQuietNow(d, utcAt(18)), false);
});

test("treats a zero-length window as off, not as permanently silent", () => {
  const d = device({quietStartMin: 60, quietEndMin: 60});
  assert.equal(isQuietNow(d, utcAt(1)), false);
  assert.equal(isQuietNow(d, utcAt(13)), false);
});

test("respects the enabled flag", () => {
  assert.equal(isQuietNow(device({quietEnabled: false}), utcAt(23)), false);
  assert.equal(isQuietNow(device({quietEnabled: undefined}), utcAt(23)), false);
});

test("applies the window in the device's own timezone", () => {
  // 20:00 UTC is 01:30 in IST, which is inside a 22:00–07:00 window.
  const ist = device({utcOffsetMinutes: 330});
  assert.equal(isQuietNow(ist, utcAt(20)), true);
  // The same instant is 12:00 in PST, which is not.
  const pst = device({utcOffsetMinutes: -480});
  assert.equal(isQuietNow(pst, utcAt(20)), false);
});

test("falls back to UTC for a corrupt or impossible offset", () => {
  // Silently shifting someone by a nonsense offset would put them in a
  // window they never chose, so an out-of-range value is ignored.
  const d = device({utcOffsetMinutes: 99999});
  assert.equal(isQuietNow(d, utcAt(23)), true);
  assert.equal(isQuietNow(device({utcOffsetMinutes: null}), utcAt(12)), false);
});

test("ignores a malformed window rather than guessing", () => {
  assert.equal(isQuietNow(device({quietStartMin: -5}), utcAt(23)), false);
  assert.equal(isQuietNow(device({quietEndMin: 5000}), utcAt(23)), false);
  assert.equal(isQuietNow(device({quietStartMin: "22:00"}), utcAt(23)), false);
});

// ── selectRecipients ───────────────────────────────────────────────────

test("selects only devices watching the figure", () => {
  const devices = [
    device({token: "a", slugs: ["taylor-swift"], quietEnabled: false}),
    device({token: "b", slugs: ["elon-musk"], quietEnabled: false}),
  ];
  assert.deepEqual(selectRecipients(devices, "taylor-swift", utcAt(12)), ["a"]);
});

test("suppresses a device that is inside its quiet window", () => {
  const devices = [
    device({token: "awake", utcOffsetMinutes: 0}),
    // 12:00 UTC is 17:30 IST — awake; make this one asleep instead.
    device({token: "asleep", quietStartMin: 0, quietEndMin: 23 * 60}),
  ];
  assert.deepEqual(selectRecipients(devices, "taylor-swift", utcAt(12)), [
    "awake",
  ]);
});

test("deduplicates a token registered twice", () => {
  const devices = [device({token: "dupe"}), device({token: "dupe"})];
  assert.deepEqual(selectRecipients(devices, "taylor-swift", utcAt(12)), [
    "dupe",
  ]);
});

test("skips malformed device rows instead of throwing", () => {
  const devices = [
    null,
    {},
    {token: ""},
    {token: 42, slugs: ["taylor-swift"]},
    {token: "ok", slugs: "taylor-swift"},
    device({token: "good"}),
  ];
  assert.deepEqual(selectRecipients(devices, "taylor-swift", utcAt(12)), [
    "good",
  ]);
});

test("returns empty for no devices", () => {
  assert.deepEqual(selectRecipients([], "x", utcAt(12)), []);
  assert.deepEqual(selectRecipients(undefined, "x", utcAt(12)), []);
});

// ── buildPushPayload ───────────────────────────────────────────────────

const spike = {zScore: 2.4137, change: -13.6, direction: "down"};
const message = {title: "Someone: sentiment down sharply", body: "14 points…"};

test("carries the title and body through unchanged", () => {
  const p = buildPushPayload({slug: "s", message, spike, score: 41.4});
  assert.equal(p.notification.title, message.title);
  assert.equal(p.notification.body, message.body);
});

test("stringifies every data value", () => {
  // FCM rejects the entire send if any data value is a number, and the
  // error does not name the offending key — so this is asserted directly.
  const p = buildPushPayload({slug: "s", message, spike, score: 41.4});
  for (const [key, value] of Object.entries(p.data)) {
    assert.equal(typeof value, "string", `data.${key} must be a string`);
  }
});

test("carries the slug so the client can deep-link", () => {
  const p = buildPushPayload({slug: "taylor-swift", message, spike, score: 41});
  assert.equal(p.data.slug, "taylor-swift");
  assert.equal(p.data.kind, "spike");
});

test("rounds the score and change for display", () => {
  const p = buildPushPayload({slug: "s", message, spike, score: 41.4});
  assert.equal(p.data.score, "41");
  assert.equal(p.data.change, "-14");
  assert.equal(p.data.zScore, "2.41");
});

test("collapses repeat alerts for one figure onto a single notification", () => {
  const p = buildPushPayload({slug: "abc", message, spike, score: 50});
  assert.equal(p.android.notification.tag, "spike-abc");
  assert.equal(p.apns.payload.aps.threadId, "spike-abc");
});

test("names the channel the client creates", () => {
  // Android 8+ silently drops a notification whose channel does not exist.
  const p = buildPushPayload({slug: "s", message, spike, score: 50});
  assert.equal(p.android.notification.channelId, "crititrack_alerts");
  assert.equal(p.android.priority, "high");
});

// ── chunkTokens ────────────────────────────────────────────────────────

test("splits at the FCM multicast limit", () => {
  const tokens = Array.from({length: 1201}, (_, i) => `t${i}`);
  const batches = chunkTokens(tokens);
  assert.equal(batches.length, 3);
  assert.equal(batches[0].length, MULTICAST_LIMIT);
  assert.equal(batches[2].length, 201);
  assert.equal(batches.flat().length, tokens.length);
});

test("returns one batch on the exact boundary", () => {
  const tokens = Array.from({length: MULTICAST_LIMIT}, (_, i) => `t${i}`);
  assert.equal(chunkTokens(tokens).length, 1);
});

test("returns nothing for no tokens", () => {
  assert.deepEqual(chunkTokens([]), []);
});

test("never exceeds the limit even if asked to", () => {
  const tokens = Array.from({length: 900}, (_, i) => `t${i}`);
  assert.equal(chunkTokens(tokens, 100000)[0].length, MULTICAST_LIMIT);
});

// ── deadTokensFrom ─────────────────────────────────────────────────────

test("collects tokens whose failure is permanent", () => {
  const batch = {
    responses: [
      {success: true},
      {
        success: false,
        error: {code: "messaging/registration-token-not-registered"},
      },
      {success: false, error: {code: "messaging/invalid-argument"}},
    ],
  };
  assert.deepEqual(deadTokensFrom(batch, ["a", "b", "c"]), ["b", "c"]);
});

test("keeps tokens that failed for a transient reason", () => {
  // Deleting on a server blip would unsubscribe people because Google had
  // a bad minute.
  const batch = {
    responses: [
      {success: false, error: {code: "messaging/server-unavailable"}},
      {success: false, error: {code: "messaging/quota-exceeded"}},
      {success: false, error: {code: "messaging/internal-error"}},
    ],
  };
  assert.deepEqual(deadTokensFrom(batch, ["a", "b", "c"]), []);
});

test("survives a malformed batch response", () => {
  assert.deepEqual(deadTokensFrom(null, ["a"]), []);
  assert.deepEqual(deadTokensFrom({}, ["a"]), []);
  assert.deepEqual(deadTokensFrom({responses: [null]}, ["a"]), []);
  assert.deepEqual(deadTokensFrom({responses: [{success: false}]}, ["a"]), []);
});
