"use client";

import { useEffect } from "react";

/**
 * What error.tsx and global-error.tsx both show: retry first, since a failed
 * fetch often works the second time, and a full reload for when this tab is
 * running an old bundle.
 */
export function ErrorCard({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="glass w-full rounded-glass p-8 text-center">
      <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500/80 to-orange-500/80 text-2xl">
        😵
      </div>
      <h1 className="text-xl font-bold">משהו השתבש</h1>
      <p className="mt-2 text-sm leading-relaxed text-white/60">
        המסך הזה לא נטען. אפשר לנסות שוב, ואם זה לא עוזר, לרענן את האפליקציה.
      </p>
      <div className="mt-6 flex flex-col gap-2.5">
        <button
          onClick={() => retry()}
          className="tap w-full rounded-2xl bg-gradient-to-l from-brand-500 to-ocean-500 px-5 text-sm font-bold text-white shadow-lg transition active:scale-[0.98]"
        >
          לנסות שוב
        </button>
        <button
          onClick={() => window.location.reload()}
          className="tap w-full rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-semibold transition active:scale-[0.98]"
        >
          לרענן את האפליקציה
        </button>
      </div>
      {/* Server errors reach the client as a digest only; it matches the Vercel log line. */}
      {error.digest && (
        <p className="mt-5 font-mono text-[11px] tracking-wide text-white/25" dir="ltr">
          {error.digest}
        </p>
      )}
    </div>
  );
}
