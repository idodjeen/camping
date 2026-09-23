"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Mail, Send } from "lucide-react";
import { useState } from "react";

import { toast } from "@/components/toast";
import { ApiError, fetcher, send } from "@/lib/api";
import { cn } from "@/lib/utils";

const TYPES = [
  { key: "unclaimed", label: "ציוד שחסר", who: "לכולם" },
  { key: "countdown", label: "ספירה לאחור", who: "לכולם" },
  { key: "packing", label: "תזכורת אריזה", who: "אישית לכל אחד" },
  { key: "shopping", label: "קניות שנשארו", who: "לעידו וניר" },
] as const;

type Preview = {
  type: string;
  count: number;
  messages: { to: string; subject: string; text: string }[];
};

/**
 * Admin-only. Shows exactly what would be sent, to whom, before sending —
 * these land in four other people's inboxes and there is no undo.
 */
export function AdminNotify() {
  const [type, setType] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  async function pick(key: string) {
    if (type === key) {
      setType(null);
      setPreview(null);
      return;
    }
    setType(key);
    setPreview(null);
    setLoading(true);
    try {
      setPreview(await fetcher<Preview>(`/api/admin/notify?type=${key}`));
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "לא הצלחנו להכין תצוגה מקדימה");
      setType(null);
    } finally {
      setLoading(false);
    }
  }

  async function doSend() {
    if (!type || !preview) return;
    setSending(true);
    try {
      const res = await send<{ sent: number; failed?: number }>("/api/admin/notify", "POST", { type });
      toast(
        res.failed ? `נשלחו ${res.sent}, נכשלו ${res.failed}` : `נשלחו ${res.sent} מיילים ✓`,
        res.failed ? "error" : "ok",
      );
      setType(null);
      setPreview(null);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "השליחה נכשלה");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="glass mb-6 rounded-2xl p-4">
      <div className="mb-3 flex items-center gap-2">
        <Mail className="size-4 text-brand-300" />
        <h2 className="text-sm font-semibold">שליחת תזכורת במייל</h2>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {TYPES.map((t) => (
          <button
            key={t.key}
            onClick={() => pick(t.key)}
            className={cn(
              "tap rounded-xl border px-3 py-2 text-start transition active:scale-95",
              type === t.key
                ? "border-brand-400/40 bg-brand-500/15"
                : "border-white/10 bg-white/5",
            )}
          >
            <span className="block text-xs font-semibold">{t.label}</span>
            <span className="block text-[10px] text-white/40">{t.who}</span>
          </button>
        ))}
      </div>

      <AnimatePresence>
        {(loading || preview) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            {loading ? (
              <p className="mt-3 flex items-center gap-2 text-xs text-white/45">
                <Loader2 className="size-3.5 animate-spin" />
                מכינים תצוגה מקדימה…
              </p>
            ) : preview && preview.count === 0 ? (
              <p className="mt-3 rounded-xl bg-white/5 p-3 text-xs text-aqua-300">
                אין למי לשלוח — הכול מעודכן 🎉
              </p>
            ) : preview ? (
              <>
                <p className="mt-3 text-[11px] text-white/45">
                  ישלח ל-{preview.count} נמענים: {preview.messages.map((m) => m.to).join(", ")}
                </p>
                <div className="mt-2 max-h-56 overflow-y-auto rounded-xl bg-night-950/60 p-3">
                  <p className="mb-1 text-[11px] font-semibold text-brand-300">
                    {preview.messages[0]?.subject}
                  </p>
                  <pre className="whitespace-pre-wrap break-words font-sans text-[11px] leading-relaxed text-white/60">
                    {preview.messages[0]?.text}
                  </pre>
                </div>
                <button
                  onClick={doSend}
                  disabled={sending}
                  className="tap mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-brand-500 to-ocean-500 text-sm font-bold text-white transition active:scale-95 disabled:opacity-40"
                >
                  {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  לשלוח עכשיו
                </button>
              </>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
