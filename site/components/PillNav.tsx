"use client";

import { useState } from "react";
import Link from "next/link";
import { t } from "@/lib/i18n";
import ThemeToggle from "./ThemeToggle";
import LocaleSwitcher from "./LocaleSwitcher";
import { useLocale } from "./locale-store";

const FIGURE = "/figure/";

/**
 * The floating pill navigation. The search lives here — type a name and
 * it opens that figure's live profile — so the home page below can lead
 * with the headline and the categories instead of a search box.
 *
 * Shell strings run through `t()` against the reader's chosen locale; the
 * analytical copy on the pages themselves stays English, per the note in
 * `lib/i18n.ts`.
 */
export default function PillNav() {
  const [q, setQ] = useState("");
  const locale = useLocale();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    window.location.href = term
      ? `${FIGURE}?q=${encodeURIComponent(term)}`
      : FIGURE;
  }

  return (
    <div className="pillnav-wrap">
      <nav className="pillnav" aria-label="Primary">
        <Link href="/" className="pillnav-brand">
          CritiTrack
        </Link>

        <form className="pillnav-search" onSubmit={submit} role="search">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle
              cx="11"
              cy="11"
              r="7"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="m20 20-3.5-3.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("search.placeholder", locale)}
            aria-label={t("search.placeholder", locale)}
          />
        </form>

        <div className="pillnav-links">
          <Link href="/category/actors">{t("nav.explore", locale)}</Link>
          <Link href="/compare">{t("nav.compare", locale)}</Link>
          <Link href="/methodology">{t("nav.method", locale)}</Link>
          <Link href="/about">About</Link>
        </div>

        <LocaleSwitcher />
        <ThemeToggle />

        <Link href={FIGURE} className="pillnav-cta">
          {t("nav.search", locale)}
        </Link>
      </nav>
    </div>
  );
}
