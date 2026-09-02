import { describe, expect, it } from "vitest";
import { decodeMode, nextMode, resolveTheme, modeLabel } from "./theme";

describe("decodeMode", () => {
  it("accepts dark and system, defaults everything else to light", () => {
    expect(decodeMode("dark")).toBe("dark");
    expect(decodeMode("system")).toBe("system");
    expect(decodeMode("light")).toBe("light");
    expect(decodeMode(null)).toBe("light");
    expect(decodeMode("garbage")).toBe("light");
  });
});

describe("nextMode", () => {
  it("cycles light → dark → system → light", () => {
    expect(nextMode("light")).toBe("dark");
    expect(nextMode("dark")).toBe("system");
    expect(nextMode("system")).toBe("light");
  });
});

describe("resolveTheme", () => {
  it("passes an explicit mode straight through", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
  it("follows the device only for system", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});

describe("modeLabel", () => {
  it("names each mode", () => {
    expect(modeLabel("light")).toBe("Light");
    expect(modeLabel("dark")).toBe("Dark");
    expect(modeLabel("system")).toBe("System");
  });
});
