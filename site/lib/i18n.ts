/**
 * A small, dependency-free string catalogue for the site shell.
 *
 * Scope is deliberately narrow: navigation, the search prompt, and the
 * handful of labels that frame every page. The analytical copy — method
 * explanations, disclaimers, the editorial position — stays English-only
 * for now, because a partial or machine translation of language that
 * makes careful claims about living people would be worse than one
 * honest language. `missingKeys` exists so a CI check can prove the
 * catalogue is complete for the locales it does claim to support.
 *
 * `t()` falls back to English for any key a locale is missing, so a gap
 * degrades to English rather than showing a raw key.
 */

export const LOCALES = ["en", "hi"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

type Catalog = Record<string, string>;

const en: Catalog = {
  "nav.search": "Search",
  "nav.explore": "Explore",
  "nav.compare": "Compare",
  "nav.watchlist": "Watchlist",
  "nav.method": "Method",
  "search.placeholder": "Search any public figure",
  "search.hint": "Try a name, or part of one",
  "figure.sentiment": "Sentiment",
  "figure.attention": "Attention",
  "figure.controversies": "Controversies",
  "figure.coverage": "Media coverage",
  "figure.timeline": "Timeline",
  "common.loading": "Loading…",
  "common.retry": "Try again",
  "common.back": "Back",
  "common.source": "Source",
  "common.updated": "Updated {when}",
};

const hi: Catalog = {
  "nav.search": "खोज",
  "nav.explore": "देखें",
  "nav.compare": "तुलना",
  "nav.watchlist": "सूची",
  "nav.method": "पद्धति",
  "search.placeholder": "किसी भी सार्वजनिक हस्ती को खोजें",
  "search.hint": "नाम या उसका कुछ हिस्सा लिखें",
  "figure.sentiment": "भावना",
  "figure.attention": "ध्यान",
  "figure.controversies": "विवाद",
  "figure.coverage": "मीडिया कवरेज",
  "figure.timeline": "समयरेखा",
  "common.loading": "लोड हो रहा है…",
  "common.retry": "पुनः प्रयास करें",
  "common.back": "वापस",
  "common.source": "स्रोत",
  "common.updated": "{when} को अपडेट किया गया",
};

const CATALOGS: Record<Locale, Catalog> = { en, hi };

/** Keys `locale` is missing relative to English. Empty means complete. */
export function missingKeys(locale: Locale): string[] {
  const have = CATALOGS[locale];
  return Object.keys(en).filter((k) => !(k in have));
}

function isLocale(v: string): v is Locale {
  return (LOCALES as readonly string[]).includes(v);
}

/**
 * Best locale for an `Accept-Language`-style header or a stored
 * preference. Matches on the primary subtag only ("hi-IN" -> "hi") and
 * falls back to English.
 */
export function resolveLocale(pref: string | null | undefined): Locale {
  if (!pref) return DEFAULT_LOCALE;
  for (const part of pref.split(",")) {
    const tag = part.trim().split(";")[0].toLowerCase().split("-")[0];
    if (isLocale(tag)) return tag;
  }
  return DEFAULT_LOCALE;
}

/**
 * Looks up `key` for `locale`, filling `{name}` placeholders from
 * `vars`. Falls back to English, then to the key itself.
 */
export function t(
  key: string,
  locale: Locale = DEFAULT_LOCALE,
  vars?: Record<string, string | number>,
): string {
  const template = CATALOGS[locale]?.[key] ?? en[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}
