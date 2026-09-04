"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  DEFAULT_LOCALE,
  LOCALES,
  resolveLocale,
  type Locale,
} from "@/lib/i18n";

/**
 * The reader's chosen UI locale for the site shell, backed by
 * localStorage. Defaults to the browser's `navigator.language` on first
 * visit, falling back to English. Scope is the shell only — nav, search,
 * framing labels — per the note in `lib/i18n.ts`.
 *
 * Applied to `<html lang>` as a side effect so assistive tech and the
 * browser know the shell's language.
 */

const KEY = "crititrack.locale";
const EVENT = "crititrack:locale";

function read(): Locale {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored && (LOCALES as readonly string[]).includes(stored)) {
      return stored as Locale;
    }
    return resolveLocale(navigator.language);
  } catch {
    return DEFAULT_LOCALE;
  }
}

let cache: Locale = DEFAULT_LOCALE;

function getSnapshot(): Locale {
  cache = read();
  return cache;
}
function getServerSnapshot(): Locale {
  return DEFAULT_LOCALE;
}
function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useLocale(): Locale {
  const locale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // Keep <html lang> in step so assistive tech and the browser know the
  // shell's language.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return locale;
}

export function setLocale(next: Locale): void {
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* storage unavailable */
  }
  cache = next;
  window.dispatchEvent(new Event(EVENT));
}
