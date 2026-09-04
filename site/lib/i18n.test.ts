import { describe, expect, it } from "vitest";
import { t, resolveLocale, missingKeys, LOCALES } from "./i18n";

describe("t", () => {
  it("returns the locale string when present", () => {
    expect(t("nav.search", "hi")).toBe("खोज");
  });

  it("falls back to English for a missing key, then to the key itself", () => {
    expect(t("nav.search", "en")).toBe("Search");
    expect(t("does.not.exist", "hi")).toBe("does.not.exist");
  });

  it("interpolates named placeholders", () => {
    expect(t("common.updated", "en", { when: "2 hours ago" })).toBe(
      "Updated 2 hours ago",
    );
    expect(t("common.updated", "hi", { when: "कल" })).toBe(
      "कल को अपडेट किया गया",
    );
  });

  it("leaves an unknown placeholder untouched", () => {
    expect(t("common.updated", "en")).toBe("Updated {when}");
  });
});

describe("resolveLocale", () => {
  it("matches on the primary subtag and falls back to English", () => {
    expect(resolveLocale("hi-IN,en;q=0.8")).toBe("hi");
    expect(resolveLocale("fr-FR,fr;q=0.9")).toBe("en");
    expect(resolveLocale(null)).toBe("en");
  });
});

describe("catalogue completeness", () => {
  it("every supported locale defines every English key", () => {
    for (const locale of LOCALES) {
      expect(missingKeys(locale)).toEqual([]);
    }
  });
});
