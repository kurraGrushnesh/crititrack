"use client";

import { LOCALES } from "@/lib/i18n";
import { useLocale, setLocale } from "./locale-store";

const NAME: Record<string, string> = { en: "EN", hi: "हिं" };

/**
 * A small segmented control for the shell locale. Only the languages the
 * catalogue actually covers are offered.
 */
export default function LocaleSwitcher() {
  const locale = useLocale();
  return (
    <div className="locale-switch" role="group" aria-label="Language">
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          className={l === locale ? "is-active" : ""}
          aria-pressed={l === locale}
          onClick={() => setLocale(l)}
        >
          {NAME[l] ?? l}
        </button>
      ))}
    </div>
  );
}
