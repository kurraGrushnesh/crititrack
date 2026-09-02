"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  THEME_KEY,
  decodeMode,
  nextMode,
  resolveTheme,
  modeLabel,
  type ThemeMode,
} from "@/lib/theme";

function read(): ThemeMode {
  try {
    return decodeMode(localStorage.getItem(THEME_KEY));
  } catch {
    return "light";
  }
}

const subs = new Set<() => void>();
function subscribe(cb: () => void) {
  subs.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    subs.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}
function notify() {
  subs.forEach((cb) => cb());
}

function applyTheme(mode: ThemeMode) {
  const prefersDark = window.matchMedia(
    "(prefers-color-scheme: dark)",
  ).matches;
  const t = resolveTheme(mode, prefersDark);
  const root = document.documentElement;
  root.setAttribute("data-theme", t);
  root.style.colorScheme = t;
}

function ThemeIcon({ mode }: { mode: ThemeMode }) {
  if (mode === "system") {
    return (
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <rect
          x="3"
          y="4"
          width="18"
          height="13"
          rx="2"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path d="M8 21h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (mode === "dark") {
    return (
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path
          d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"
          fill="currentColor"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <circle cx="12" cy="12" r="4.5" fill="currentColor" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <line
          key={deg}
          x1="12"
          y1="2.5"
          x2="12"
          y2="5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          transform={`rotate(${deg} 12 12)`}
        />
      ))}
    </svg>
  );
}

/**
 * One-tap theme control: Light → Dark → System → Light. The chosen
 * preference persists in `localStorage`; a boot script in <head> applies
 * it before first paint so there is no flash.
 */
export default function ThemeToggle() {
  const mode = useSyncExternalStore(
    subscribe,
    read,
    () => "light" as ThemeMode,
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => applyTheme(read());
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    applyTheme(mode);
  }, [mode]);

  const cycle = useCallback(() => {
    const next = nextMode(read());
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* private mode — still apply for this session */
    }
    applyTheme(next);
    notify();
  }, []);

  const label = modeLabel(mode);

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={cycle}
      aria-label={`Theme: ${label}. Activate to change.`}
      title={`Theme: ${label}`}
    >
      <ThemeIcon mode={mode} />
      <span className="theme-toggle-label">{label}</span>
    </button>
  );
}
