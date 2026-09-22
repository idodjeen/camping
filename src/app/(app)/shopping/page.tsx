"use client";

import { motion } from "framer-motion";
import { Check, Lock } from "lucide-react";
import useSWR from "swr";

import { PageTitle, SkeletonList } from "@/components/skeletons";
import { toast } from "@/components/toast";
import { UserAvatar } from "@/components/user-avatar";
import { ApiError, fetcher, send, swrConfig } from "@/lib/api";
import { burstFrom } from "@/lib/confetti";
import { SLOT_LABELS, formatTripDay } from "@/lib/dates";
import { cn } from "@/lib/utils";

type Item = {
  id: number;
  name: string;
  quantityText: string | null;
  notes: string | null;
  isBought: boolean;
  boughtBy: { name: string; slug: string; avatarUrl: string | null } | null;
  meals: { id: number; title: string; date: string; slot: string }[];
};
type Payload = { categories: { id: number; name: string; items: Item[] }[]; canBuy: boolean };

export default function ShoppingPage() {
  const { data, isLoading, mutate } = useSWR<Payload>("/api/shopping", fetcher, swrConfig);

  async function toggle(item: Item, el: Element | null) {
    if (!data?.canBuy) return;
    const next = !item.isBought;

    const optimistic: Payload = {
      ...data,
      categories: data.categories.map((c) => ({
        ...c,
        items: c.items.map((it) => (it.id === item.id ? { ...it, isBought: next } : it)),
      })),
    };

    try {
      await mutate(
        async () => {
          await send(`/api/shopping/${item.id}`, "PATCH", { isBought: next });
          return fetcher<Payload>("/api/shopping");
        },
        { optimisticData: optimistic, rollbackOnError: true, revalidate: false },
      );
      if (next) burstFrom(el);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "לא הצלחנו לעדכן");
    }
  }

  if (isLoading && !data) {
    return (
      <>
        <PageTitle title="קניות" />
        <SkeletonList rows={6} />
      </>
    );
  }

  const all = data?.categories.flatMap((c) => c.items) ?? [];
  const bought = all.filter((i) => i.isBought).length;

  return (
    <>
      <PageTitle title="קניות" subtitle={`${bought} מתוך ${all.length} נקנו`} />

      {!data?.canBuy && (
        <p className="glass mb-4 flex items-center gap-2 rounded-2xl px-4 py-3 text-xs text-white/50">
          <Lock className="size-3.5 shrink-0" />
          רק עידו וניר מסמנים מה נקנה. אפשר לעקוב מכאן.
        </p>
      )}

      <div className="space-y-6">
        {data?.categories.map((cat) => (
          <section key={cat.id}>
            <h2 className="mb-2 px-1 text-sm font-semibold text-white/50">{cat.name}</h2>
            <div className="space-y-2">
              {cat.items.map((item) => (
                <motion.div key={item.id} layout className="glass rounded-2xl p-3.5">
                  <div className="flex items-start gap-3">
                    <button
                      onClick={(e) => toggle(item, e.currentTarget)}
                      disabled={!data.canBuy}
                      aria-pressed={item.isBought}
                      aria-label={item.isBought ? "לבטל סימון" : "לסמן כנקנה"}
                      className={cn(
                        "tap mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border transition",
                        item.isBought
                          ? "border-aqua-400/50 bg-aqua-500/25 text-aqua-200"
                          : "border-white/15 bg-white/5 text-transparent",
                        data.canBuy ? "active:scale-90" : "cursor-default opacity-60",
                      )}
                    >
                      <Check className="size-4" strokeWidth={3} />
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2">
                        <span
                          className={cn(
                            "font-semibold transition",
                            item.isBought && "text-white/40 line-through",
                          )}
                        >
                          {item.name}
                        </span>
                        {item.quantityText && (
                          <span className="rounded-md bg-white/8 px-1.5 py-0.5 text-[11px] text-white/60">
                            {item.quantityText}
                          </span>
                        )}
                        {item.notes && (
                          <span className="text-[11px] text-white/35">{item.notes}</span>
                        )}
                      </div>

                      {item.meals.length > 0 && (
                        <p className="mt-1 text-[11px] leading-relaxed text-white/35">
                          {item.meals
                            .map((m) => `${formatTripDay(m.date)} ${SLOT_LABELS[m.slot] ?? ""}`)
                            .join(" · ")}
                        </p>
                      )}
                    </div>

                    {item.isBought && item.boughtBy && (
                      <UserAvatar
                        name={item.boughtBy.name}
                        slug={item.boughtBy.slug}
                        avatarUrl={item.boughtBy.avatarUrl}
                        size={26}
                        expandable
                        title={`נקנה על ידי ${item.boughtBy.name}`}
                      />
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
