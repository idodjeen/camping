"use client";

import { usePathname, useSearchParams } from "next/navigation";

import { Chip, ChipRow } from "@/components/ui/controls";
import { markTap } from "@/lib/tap-timer";

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
 *
 * An "alert" chip (תייגו אותך) stays coloured while inactive: it answers a
 * badge, so it has to be findable the moment the page lands.
 */
export function FilterChips({
  current,
  options,
}: {
  current: string | null;
  options: { key: string | null; label: string; count?: number; tone?: "alert" }[];
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
    <ChipRow>
      {options.map((o) => (
        <Chip
          key={o.label}
          active={current === o.key}
          alert={o.tone === "alert"}
          count={o.count}
          onClick={() => pick(o.key)}
        >
          {o.label}
        </Chip>
      ))}
    </ChipRow>
  );
}
