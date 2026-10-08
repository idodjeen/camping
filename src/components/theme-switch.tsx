"use client";

import { useEffect, useState } from "react";

import { applyTheme, readThemePref, saveThemePref, type ThemePref } from "@/lib/theme";
import { cn } from "@/lib/utils";

const OPTIONS: { value: ThemePref; label: string }[] = [
  { value: "light", label: "בהיר" },
  { value: "dark", label: "כהה" },
  { value: "system", label: "לפי המכשיר" },
];

/**
 * Light, dark, or follow the device. While on "system" it also follows the
 * device live, so a phone that turns dark at sunset takes the app with it.
 */
export function ThemeSwitch() {
  // null until mounted: the stored choice exists only in the browser, and the
  // server must not guess it (that would be a hydration mismatch).
  const [pref, setPref] = useState<ThemePref | null>(null);

  useEffect(() => {
    setPref(readThemePref());
  }, []);

  useEffect(() => {
    if (pref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  return (
    <div role="radiogroup" aria-label="מראה" className="flex gap-1 rounded-full border-[1.5px] border-line bg-canvas p-1">
      {OPTIONS.map((o) => {
        const on = pref === o.value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={on}
            onClick={() => {
              setPref(o.value);
              saveThemePref(o.value);
            }}
            className={cn(
              "tap flex-1 rounded-full px-2 text-sm font-bold transition-colors",
              on ? "bg-ink text-canvas" : "text-ink active:bg-line",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
