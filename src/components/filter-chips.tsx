"use client";

import { usePathname, useSearchParams } from "next/navigation";

import { markTap } from "@/lib/tap-timer";
import { cn } from "@/lib/utils";

/**
 * Filter chips backed by the URL rather than local state.
 *
 * That is what lets a progress ring on the dashboard deep-link straight into
 * "show me what's already covered", and it means the filtered view survives a
 * refresh or being sent to someone else.
 *
 * The URL changes through the History API, which Next.js keeps in step with
 * useSearchParams, so a chip filters at once. A <Link> here made every tap a
 * server round trip, because the trip screens are dynamic routes.
 */
export function FilterChips({
  current,
  options,
}: {
  current: string | null;
  options: { key: string | null; label: string; tone?: "alert" }[];
}) {
  const path = usePathname();
  const params = useSearchParams();

  function pick(key: string | null) {
    if (key === current) return;
    const next = new URLSearchParams(params.toString());
    if (key) next.set("filter", key);
    else next.delete("filter");
    const query = next.toString();
    const url = query ? `${path}?${query}` : path;
    markTap(url, "chip");
    window.history.pushState(null, "", url);
  }

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {options.map((o) => {
        const active = current === o.key;
        return (
          <button
            key={o.label}
            type="button"
            onClick={() => pick(o.key)}
            aria-pressed={active}
            className={cn(
              "tap flex items-center rounded-xl border px-3 text-xs font-semibold transition active:scale-95",
              active ? "border-brand-400/40 bg-brand-500/20 text-brand-200"
              // An alert chip stays coloured while inactive: it is the answer
              // to "the nav badge said 2 — where are they?", so it has to be
              // findable the moment the page lands, not after you read it.
              : o.tone === "alert" ? "border-brand-400/35 bg-brand-500/15 text-brand-200"
              : "border-white/10 bg-white/5 text-white/45",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
