/**
 * Light or dark. The choice is per device, kept in localStorage: it is a
 * matter of the screen and the hour, not of the person, so it does not follow
 * you to your other phone.
 *
 *   "light" | "dark"  what you picked in the menu
 *   "system"          (or nothing stored) follow the device
 *
 * The server always renders data-theme="light"; THEME_SCRIPT runs in <head>
 * before the first paint and corrects it, so there is no flash and no
 * hydration mismatch (see "Preventing Flash" in the Next docs).
 */

export type ThemePref = "light" | "dark" | "system";
export type Theme = "light" | "dark";

export const THEME_KEY = "theme";

/** The browser bar colour per theme: the canvas, so the bar melts into the app. */
export const THEME_COLOR: Record<Theme, string> = { light: "#fff4ea", dark: "#1d1316" };

/**
 * Inline, synchronous, dependency-free: it runs before React exists. Kept in
 * step with resolveTheme() and applyTheme() below by hand; it is short enough
 * to read side by side.
 */
export const THEME_SCRIPT = `(function(){try{var p=localStorage.getItem(${JSON.stringify(THEME_KEY)});var t=p==="light"||p==="dark"?p:(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");var d=document.documentElement;d.setAttribute("data-theme",t);var c=t==="dark"?${JSON.stringify(THEME_COLOR.dark)}:${JSON.stringify(THEME_COLOR.light)};document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.setAttribute("content",c)})}catch(e){}})()`;

export function readThemePref(): ThemePref {
  try {
    const p = localStorage.getItem(THEME_KEY);
    return p === "light" || p === "dark" ? p : "system";
  } catch {
    return "system";
  }
}

export function resolveTheme(pref: ThemePref): Theme {
  if (pref !== "system") return pref;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Paints the theme now: the attribute every token keys off, and the browser bar. */
export function applyTheme(pref: ThemePref) {
  const theme = resolveTheme(pref);
  document.documentElement.setAttribute("data-theme", theme);
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((m) => m.setAttribute("content", THEME_COLOR[theme]));
}

export function saveThemePref(pref: ThemePref) {
  try {
    if (pref === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, pref);
  } catch {
    // Private mode or storage blocked: the choice still applies to this visit.
  }
  applyTheme(pref);
}
