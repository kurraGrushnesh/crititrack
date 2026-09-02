/**
 * Theme preference: light, dark, or follow the device.
 *
 * Mirrors the Flutter client's `theme_controller.dart` — same three
 * modes, same default (light: the editorial look is a light one, so a
 * first-time visitor sees it rather than whatever their OS is set to),
 * same one-tap cycle order.
 *
 * The *preference* (one of these three) is what persists. The *resolved*
 * theme (light or dark) is what gets stamped on `<html data-theme>` and
 * what the CSS keys off.
 */

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_KEY = "crititrack:theme-mode";

export function decodeMode(raw: string | null | undefined): ThemeMode {
  return raw === "dark" || raw === "system" ? raw : "light";
}

/** light → dark → system → light, for a one-tap toggle. */
export function nextMode(mode: ThemeMode): ThemeMode {
  return mode === "light" ? "dark" : mode === "dark" ? "system" : "light";
}

export function resolveTheme(
  mode: ThemeMode,
  prefersDark: boolean,
): ResolvedTheme {
  if (mode === "system") return prefersDark ? "dark" : "light";
  return mode;
}

export function modeLabel(mode: ThemeMode): string {
  return mode === "light" ? "Light" : mode === "dark" ? "Dark" : "System";
}

/**
 * The script that runs before first paint, inlined in <head>. Reads the
 * stored preference and stamps `data-theme` + `color-scheme` on the root
 * so there is no flash of the wrong theme. Kept tiny and dependency-free
 * because it is serialised into the HTML as a string.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{
var m=localStorage.getItem(${JSON.stringify(THEME_KEY)});
if(m!=='dark'&&m!=='system')m='light';
var dark=m==='dark'||(m==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);
var t=dark?'dark':'light';
document.documentElement.setAttribute('data-theme',t);
document.documentElement.style.colorScheme=t;
}catch(e){}})();`;
