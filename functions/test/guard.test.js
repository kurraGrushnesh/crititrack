"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  GuardError,
  secondsUntilNextHour,
  secondsUntilNextDay,
  RATE_PER_HOUR,
  RATE_PER_DAY,
  GLOBAL_DAILY_LOOKUPS,
  CORRECTION_PER_HOUR,
  CORRECTION_PER_DAY,
  clientIp,
  hashIp,
} = require("../lib/guard");

test("GuardError carries a status and optional headers", () => {
  const e = new GuardError("rate_limited", "slow down", 429, {"Retry-After": "60"});
  assert.equal(e.code, "rate_limited");
  assert.equal(e.status, 429);
  assert.equal(e.headers["Retry-After"], "60");
  assert.ok(e instanceof Error);
});

test("Retry-After for the hourly bucket is within the hour and positive", () => {
  const s = secondsUntilNextHour(new Date("2026-08-28T10:15:30Z"));
  assert.equal(s, 44 * 60 + 30);
  assert.ok(s > 0 && s <= 3600);
});

test("Retry-After for the daily bucket is within the day and positive", () => {
  const s = secondsUntilNextDay(new Date("2026-08-28T23:59:00Z"));
  assert.equal(s, 60);
  assert.ok(s > 0 && s <= 86400);
});

test("Retry-After never returns zero on an exact boundary", () => {
  assert.ok(secondsUntilNextHour(new Date("2026-08-28T10:00:00Z")) > 0);
  assert.ok(secondsUntilNextDay(new Date("2026-08-28T00:00:00Z")) > 0);
});

test("budgets are ordered so the hourly cap binds before the daily one", () => {
  assert.ok(RATE_PER_HOUR < RATE_PER_DAY,
      "an hourly cap at or above the daily cap would never bind");
  assert.ok(RATE_PER_DAY <= GLOBAL_DAILY_LOOKUPS,
      "one user must not be able to exhaust the global ceiling alone");
});

test("correction budgets are low and ordered", () => {
  assert.ok(CORRECTION_PER_HOUR < CORRECTION_PER_DAY);
  assert.ok(CORRECTION_PER_DAY <= RATE_PER_DAY,
      "an unauthenticated form should not out-spend an authenticated user");
});

test("hashIp is deterministic, short hex, and does not echo the address", () => {
  const a = hashIp("203.0.113.7");
  const b = hashIp("203.0.113.7");
  const c = hashIp("203.0.113.8");
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^[0-9a-f]{16}$/);
  assert.ok(!a.includes("203"));
});

test("clientIp prefers the first X-Forwarded-For entry", () => {
  assert.equal(
      clientIp({headers: {"x-forwarded-for": "198.51.100.2, 10.0.0.1"}}),
      "198.51.100.2",
  );
});

test("clientIp falls back to req.ip, then the socket, then unknown", () => {
  assert.equal(clientIp({headers: {}, ip: "192.0.2.5"}), "192.0.2.5");
  assert.equal(
      clientIp({headers: {}, socket: {remoteAddress: "192.0.2.9"}}),
      "192.0.2.9",
  );
  assert.equal(clientIp({headers: {}}), "unknown");
});
