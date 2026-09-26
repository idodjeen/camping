"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import useSWR from "swr";

import { CheckBox } from "@/components/personal-list";
import { toast } from "@/components/toast";
import { ApiError, fetcher, send, swrConfig } from "@/lib/api";
import { burstFrom } from "@/lib/confetti";
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
  const { data, mutate } = useSWR<Payload>("/api/me", fetcher, swrConfig);

  async function togglePacked(itemId: number, next: boolean, el: Element | null) {
    if (next) burstFrom(el);
    try {
      await mutate(
        async () => {
          await send(`/api/gear/${itemId}/claim`, "PATCH", { isPacked: next });
          return fetcher<Payload>("/api/me");
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

  return (
    <section className="mb-8">
      <h2 className="mb-2 px-1 text-sm font-semibold text-white/50">
        ציוד מחנאות שאני מביא {data.claims.length > 0 && `· ${packed}/${data.claims.length} ארוז`}
      </h2>

      {data.claims.length === 0 ? (
        <p className="glass rounded-2xl px-4 py-5 text-center text-sm text-white/45">
          עוד לא התחייבת על ציוד.
          <br />
          <Link href="/gear" className="text-brand-300 underline underline-offset-2">
            חזור לרשימה המלאה
          </Link>{" "}
          ותפוס משהו.
        </p>
      ) : (
        <div className="space-y-2">
          {data.claims.map((c) => (
            <motion.div key={c.itemId} layout className="glass flex items-center gap-3 rounded-2xl p-3.5">
              <CheckBox
                checked={c.isPacked}
                onToggle={(el) => togglePacked(c.itemId, !c.isPacked, el)}
                label={c.isPacked ? "לבטל ארוז" : "לסמן כארוז"}
              />
              <div className="min-w-0 flex-1">
                <span className={cn("font-semibold", c.isPacked && "text-white/40 line-through")}>
                  {c.name}
                </span>
                {c.qty > 1 && (
                  <span className="ms-2 rounded-md bg-brand-500/20 px-1.5 py-0.5 text-[11px] font-bold text-brand-200">
                    ×{c.qty}
                  </span>
                )}
                <p className="text-[11px] text-white/35">{c.categoryName}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
}
