"use strict";

/**
 * Request coalescing (Step 16.5 performance): concurrent callers for the
 * same key share one in-flight operation, and the registry always
 * clears so a later call starts fresh. Pure and timer-free — no network,
 * no real provider latency.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const {coalesce} = require("../lib/inflight");

test("two concurrent calls for the same key share one factory invocation", async () => {
  const inflight = new Map();
  let calls = 0;
  let resolve;
  const factory = () => {
    calls += 1;
    return new Promise((r) => {
      resolve = r;
    });
  };

  const a = coalesce(inflight, "jane-doe", factory);
  const b = coalesce(inflight, "jane-doe", factory);
  assert.equal(calls, 1, "the second caller must not start a second factory run");

  resolve("assembled payload");
  assert.equal(await a, "assembled payload");
  assert.equal(await b, "assembled payload");
});

test("different keys never share work — no cross-entity merging", async () => {
  const inflight = new Map();
  const calls = [];
  const factory = (key) => () => {
    calls.push(key);
    return Promise.resolve(key);
  };

  const a = coalesce(inflight, "jane-doe", factory("jane-doe"));
  const b = coalesce(inflight, "john-doe", factory("john-doe"));

  assert.deepEqual(calls.sort(), ["jane-doe", "john-doe"]);
  assert.equal(await a, "jane-doe");
  assert.equal(await b, "john-doe");
});

test("the registry clears once the operation settles, so a later call re-runs the factory", async () => {
  const inflight = new Map();
  let calls = 0;
  const factory = () => {
    calls += 1;
    return Promise.resolve(calls);
  };

  const first = await coalesce(inflight, "jane-doe", factory);
  assert.equal(first, 1);
  assert.equal(inflight.has("jane-doe"), false, "must not linger after settling");

  const second = await coalesce(inflight, "jane-doe", factory);
  assert.equal(second, 2, "a call after the first settled must run its own factory");
});

test("a failure clears the registry too — a later call is not stuck rejecting forever", async () => {
  const inflight = new Map();
  let attempt = 0;
  const factory = () => {
    attempt += 1;
    return attempt === 1 ?
      Promise.reject(new Error("provider down")) :
      Promise.resolve("recovered");
  };

  await assert.rejects(() => coalesce(inflight, "jane-doe", factory), /provider down/);
  assert.equal(inflight.has("jane-doe"), false);

  const recovered = await coalesce(inflight, "jane-doe", factory);
  assert.equal(recovered, "recovered");
});

test("a failure is shared by every concurrent caller, not retried per-caller", async () => {
  const inflight = new Map();
  let calls = 0;
  const factory = () => {
    calls += 1;
    return Promise.reject(new Error("boom"));
  };

  const a = coalesce(inflight, "jane-doe", factory);
  const b = coalesce(inflight, "jane-doe", factory);

  await assert.rejects(() => a, /boom/);
  await assert.rejects(() => b, /boom/);
  assert.equal(calls, 1);
});
