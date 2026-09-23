"use client";

import { Share2 } from "lucide-react";

import { toast } from "@/components/toast";

/**
 * Copy a list as WhatsApp-ready text, or hand it to the native share sheet.
 *
 * `getText` is a synchronous getter on purpose. Both `navigator.share` and
 * `navigator.clipboard.writeText` require an active user gesture, and iOS
 * Safari drops that the moment you `await` anything first — the call then fails
 * silently, with no error and nothing copied. So the text must be built from
 * data the page already holds, never fetched on demand.
 */
export function CopyButton({
  getText,
  label = "שיתוף",
}: {
  getText: () => string;
  label?: string;
}) {
  function onClick() {
    const text = getText();

    const copy = () =>
      navigator.clipboard
        .writeText(text)
        .then(() => toast("הועתק — אפשר להדביק בוואטסאפ", "ok"))
        .catch(() => toast("לא הצלחנו להעתיק"));

    if (typeof navigator.share === "function") {
      navigator.share({ text }).catch((err: unknown) => {
        // Dismissing the share sheet is a choice, not a failure — only fall
        // back to the clipboard when sharing genuinely could not run.
        if ((err as { name?: string })?.name !== "AbortError") copy();
      });
      return;
    }

    void copy();
  }

  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="tap flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-semibold text-white/60 transition active:scale-95"
    >
      <Share2 className="size-3.5" />
      {label}
    </button>
  );
}
