import { describe, expect, it } from "vitest";
import { displayHost, isSafeUrl, parseSafeUrl } from "./safe-url";

/**
 * Ported from `test/safe_url_test.dart`. The link policy has to be the
 * same in both clients, so these cases mirror the Dart suite.
 */

describe("parseSafeUrl accepts", () => {
  it("ordinary https article links", () => {
    for (const url of [
      "https://example.com",
      "https://www.bbc.co.uk/news/article-123",
      "https://youtube.com/watch?v=abc123",
      "https://example.com:8443/path?q=1#frag",
    ]) {
      expect(parseSafeUrl(url), url).not.toBeNull();
    }
  });

  it("a link with surrounding whitespace", () => {
    expect(parseSafeUrl("  https://example.com  ")).not.toBeNull();
  });
});

describe("parseSafeUrl rejects", () => {
  it("script and data schemes", () => {
    for (const url of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html;base64,PHNjcmlwdD4=",
      "blob:https://example.com/uuid",
      "vbscript:msgbox(1)",
    ]) {
      expect(parseSafeUrl(url), url).toBeNull();
    }
  });

  it("local and app schemes", () => {
    for (const url of [
      "file:///etc/passwd",
      "content://media/external/images/1",
      "intent://scan#Intent;scheme=zxing;end",
      "about:blank",
    ]) {
      expect(parseSafeUrl(url), url).toBeNull();
    }
  });

  it("plain http, which is downgrade-prone", () => {
    expect(parseSafeUrl("http://example.com")).toBeNull();
  });

  it("embedded credentials, a phishing signal", () => {
    expect(parseSafeUrl("https://apple.com@evil.example")).toBeNull();
    expect(parseSafeUrl("https://user:pw@example.com")).toBeNull();
  });

  it("URLs with no real host", () => {
    for (const url of ["https://", "https:///path", "https", ""]) {
      expect(parseSafeUrl(url), url).toBeNull();
    }
  });

  it("null and blank input", () => {
    expect(parseSafeUrl(null)).toBeNull();
    expect(parseSafeUrl(undefined)).toBeNull();
    expect(parseSafeUrl("   ")).toBeNull();
  });

  it("malformed input, without throwing", () => {
    for (const url of ["https://exa mple.com", "://///", "ht!tp://x"]) {
      expect(() => parseSafeUrl(url), url).not.toThrow();
    }
  });
});

describe("displayHost", () => {
  it("shows the host and drops a leading www.", () => {
    expect(displayHost("https://www.bbc.co.uk/news")).toBe("bbc.co.uk");
    expect(displayHost("https://variety.com/x")).toBe("variety.com");
  });

  it("is empty for anything we would not open", () => {
    expect(displayHost("javascript:alert(1)")).toBe("");
    expect(displayHost("http://example.com")).toBe("");
    expect(displayHost(null)).toBe("");
  });
});

describe("isSafeUrl", () => {
  it("agrees with parseSafeUrl, so redirects are held to the same policy", () => {
    expect(isSafeUrl(new URL("https://example.com"))).toBe(true);
    expect(isSafeUrl(new URL("http://example.com"))).toBe(false);
    expect(isSafeUrl(new URL("javascript:alert(1)"))).toBe(false);
  });
});
