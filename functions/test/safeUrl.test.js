"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {parseSafeUrl, isSafeUrl, displayHost} = require("../lib/safeUrl");

// Kept in step with test/safe_url_test.dart and
// site/lib/safe-url.test.ts. The three clients must agree on which links
// are openable.

test("accepts ordinary https article links", () => {
  for (const url of [
    "https://example.com",
    "https://www.bbc.co.uk/news/article-123",
    "https://youtube.com/watch?v=abc123",
    "https://example.com:8443/path?q=1#frag",
    "  https://example.com  ",
  ]) {
    assert.notEqual(parseSafeUrl(url), null, url);
  }
});

test("rejects script, data and app schemes", () => {
  for (const url of [
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "data:text/html;base64,PHNjcmlwdD4=",
    "blob:https://example.com/uuid",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "content://media/external/images/1",
    "intent://scan#Intent;scheme=zxing;end",
    "about:blank",
  ]) {
    assert.equal(parseSafeUrl(url), null, url);
  }
});

test("rejects plain http", () => {
  assert.equal(parseSafeUrl("http://example.com"), null);
});

test("rejects embedded credentials", () => {
  assert.equal(parseSafeUrl("https://apple.com@evil.example"), null);
  assert.equal(parseSafeUrl("https://user:pw@example.com"), null);
});

test("rejects URLs with no real host", () => {
  for (const url of ["https://", "https:///path", "https", ""]) {
    assert.equal(parseSafeUrl(url), null, url);
  }
});

test("rejects non-string and blank input without throwing", () => {
  for (const v of [null, undefined, 42, {}, "   "]) {
    assert.doesNotThrow(() => parseSafeUrl(v));
    assert.equal(parseSafeUrl(v), null);
  }
});

test("does not throw on malformed input", () => {
  for (const url of ["https://exa mple.com", "://///", "ht!tp://x"]) {
    assert.doesNotThrow(() => parseSafeUrl(url), url);
  }
});

test("displayHost shows the host and drops a leading www.", () => {
  assert.equal(displayHost("https://www.bbc.co.uk/news"), "bbc.co.uk");
  assert.equal(displayHost("https://variety.com/x"), "variety.com");
  assert.equal(displayHost("javascript:alert(1)"), "");
  assert.equal(displayHost(null), "");
});

test("isSafeUrl agrees with parseSafeUrl", () => {
  assert.equal(isSafeUrl(new URL("https://example.com")), true);
  assert.equal(isSafeUrl(new URL("http://example.com")), false);
  assert.equal(isSafeUrl(new URL("javascript:alert(1)")), false);
});
