"use client";

import { motion } from "framer-motion";
import { Package } from "lucide-react";
import useSWR from "swr";

import { toast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { CheckBox } from "@/components/ui/controls";
import { Badge, EmptyState } from "@/components/ui/surfaces";
import { ApiError, fetcher, send, swrConfig } from "@/lib/api";
import { burstFrom } from "@/lib/confetti";
import { markTap } from "@/lib/tap-timer";
import { useTrip } from "@/lib/trip-client";
import { cn } from "@/lib/utils";

export type MyClaim = {
  itemId: number;
  qty: number;
  isPacked: boolean;
  name: string;
  qtyLabel: string | null;
  categoryName: string;
};
type Payload = { claims: MyClaim[] } & Record<string, unknown>;

/**
 * The shared-camp gear this person signed up to bring, with a packed checkbox.
 * Lives on the gear screen next to the private personal list so both packing
 * lists are managed in one place; claiming and releasing still happens from
 * the main list, which is where the quantities are visible.
 */
export function MyGearList() {
  const { api, page } = useTrip();
  const { data, mutate } = useSWR<Payload>(api("/me"), fetcher, swrConfig);

  async function togglePacked(itemId: number, next: boolean, el: Element | null) {
    if (next) burstFrom(el);
    try {
      await mutate(
        async () => {
          await send(api(`/gear/${itemId}/claim`), "PATCH", { isPacked: next });
          return fetcher<Payload>(api("/me"));
        },
        {
          optimisticData: data && {
            ...data,
            claims: data.claims.map((c) => (c.itemId === itemId ? { ...c, isPacked: next } : c)),
          },
          rollbackOnError: true,
          revalidate: false,
        },
      );
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "לא הצלחנו לעדכן");
    }
  }

  if (!data) return null;
  const packed = data.claims.filter((c) => c.isPacked).length;

  // Back to the full list the way the chips go: the URL changes in place.
  function showAll() {
    const url = page("/gear");
    markTap(url, "chip");
    window.history.pushState(null, "", url);
  }

  return (
    <section className="mb-8 flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-2 px-1">
        <h2 className="font-display text-lg">ציוד מחנאות שאני מביא</h2>
        {data.claims.length > 0 && (
          <span className="shrink-0 text-sm text-muted">
            <span dir="ltr">
              {packed}/{data.claims.length}
            </span>{" "}
            ארוז
          </span>
        )}
      </div>

      {data.claims.length === 0 ? (
        <EmptyState
          icon={<Package />}
          tone="rose"
          title="עוד לא לקחת ציוד"
          body="ברשימה המלאה אפשר ללחוץ ״אני מביא״ על מה שחסר."
          action={
            <Button variant="secondary" size="sm" onClick={showAll}>
              לרשימה המלאה
            </Button>
          }
        />
      ) : (
        data.claims.map((c) => (
          <motion.div
            key={c.itemId}
            layout="position"
            className="flex items-center gap-2 rounded-[24px] border-[1.5px] border-line bg-surface py-1.5 ps-1.5 pe-4"
          >
            <CheckBox
              checked={c.isPacked}
              onToggle={(el) => togglePacked(c.itemId, !c.isPacked, el)}
              label={c.isPacked ? "לבטל ארוז" : "לסמן כארוז"}
            />
            <div className="min-w-0 flex-1 py-1.5 leading-snug">
              <p className={cn("text-base font-bold", c.isPacked && "text-muted line-through")}>
                {c.name}
                {c.qty > 1 && (
                  <Badge tone="peach" className="ms-2 h-6 align-middle">
                    <span dir="ltr">×{c.qty}</span>
                  </Badge>
                )}
              </p>
              <p className="text-[13px] text-muted">{c.categoryName}</p>
            </div>
          </motion.div>
        ))
      )}
    </section>
  );
}
