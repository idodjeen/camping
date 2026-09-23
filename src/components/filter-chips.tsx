"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Filter chips backed by the URL rather than local state.
 *
 * That is what lets a progress ring on the dashboard deep-link straight into
 * "show me what's already covered", and it means the filtered view survives a
 * refresh or being sent to someone else.
 */
export function FilterChips({
  current,
  options,
}: {
  current: string | null;
  options: { key: string | null; label: string }[];
}) {
  const path = usePathname();

  return (
    <div className="mb-4 flex gap-2">
      {options.map((o) => {
        const active = current === o.key;
        return (
          <Link
            key={o.label}
            href={o.key ? { pathname: path, query: { filter: o.key } } : { pathname: path }}
            scroll={false}
            className={cn(
              "tap flex items-center rounded-xl border px-3 text-xs font-semibold transition active:scale-95",
              active
                ? "border-brand-400/40 bg-brand-500/20 text-brand-200"
                : "border-white/10 bg-white/5 text-white/45",
            )}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}
