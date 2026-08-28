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
