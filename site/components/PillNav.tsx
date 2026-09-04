"use client";

import Link from "next/link";
import { t } from "@/lib/i18n";
import ThemeToggle from "./ThemeToggle";
import LocaleSwitcher from "./LocaleSwitcher";
import SearchBox from "./SearchBox";
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
  const locale = useLocale();

  return (
    <div className="pillnav-wrap">
      <nav className="pillnav" aria-label="Primary">
        <Link href="/" className="pillnav-brand">
          CritiTrack
        </Link>

        <div className="pillnav-search">
          <SearchBox placeholder={t("search.placeholder", locale)} />
        </div>

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
