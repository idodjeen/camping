"use client";

import { useState } from "react";

import { toast } from "@/components/toast";
import { ApiError, send } from "@/lib/api";
import { cn } from "@/lib/utils";

export type NotifyPrefs = { mentions: boolean; covered: boolean; messages: boolean };

const OPTIONS: { key: keyof NotifyPrefs; label: string; hint: string }[] = [
  { key: "covered", label: "פריטים שכוסו", hint: "כשפריט ציוד מגיע לכיסוי מלא" },
  { key: "messages", label: "הודעות", hint: "כל הודעה חדשה בצ׳אט ובפריטים" },
  { key: "mentions", label: "תיוגים", hint: "כשמישהו כותב @השם שלך" },
];

/**
 * Which kinds of notification reach my bell. Toggles apply at once and roll
 * back if the server refuses, the same optimistic feel as the packed checkbox.
 */
export function NotificationPrefs({
  prefs,
  onChanged,
}: {
  prefs: NotifyPrefs;
  /** Refresh whatever else reads the prefs or the feed (/api/me, the bell). */
  onChanged: () => void;
}) {
  const [local, setLocal] = useState(prefs);

  async function flip(key: keyof NotifyPrefs) {
    const next = !local[key];
    setLocal((p) => ({ ...p, [key]: next }));
    try {
      await send("/api/me/prefs", "PATCH", { [key]: next });
      onChanged();
    } catch (err) {
      setLocal((p) => ({ ...p, [key]: !next }));
      toast(err instanceof ApiError ? err.message : "לא הצלחנו לעדכן");
    }
  }

  return (
    <section className="mb-7">
      <h2 className="mb-2 px-1 text-sm font-semibold text-white/50">התראות</h2>
      <div className="glass divide-y divide-white/5 rounded-2xl">
        {OPTIONS.map(({ key, label, hint }) => (
          <button
            key={key}
            role="switch"
            aria-checked={local[key]}
            onClick={() => flip(key)}
            className="tap flex w-full items-center gap-3 px-4 py-3 text-start"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{label}</span>
              <span className="block text-[11px] text-white/40">{hint}</span>
            </span>
            <span
              className={cn(
                "relative h-6 w-10 shrink-0 rounded-full transition",
                local[key] ? "bg-brand-500" : "bg-white/15",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 size-5 rounded-full bg-white transition-all",
                  local[key] ? "start-[18px]" : "start-0.5",
                )}
              />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
