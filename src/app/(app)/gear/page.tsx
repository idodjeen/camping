"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Minus, Plus, Sparkles, X } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";

import { AvatarStack } from "@/components/avatar-stack";
import { PageTitle, SkeletonList } from "@/components/skeletons";
import { toast } from "@/components/toast";
import { ApiError, fetcher, send, swrConfig } from "@/lib/api";
import { burstFrom } from "@/lib/confetti";
import { cn } from "@/lib/utils";

type Claim = {
  userId: number;
  name: string;
  slug: string;
  avatarUrl: string | null;
  qty: number;
  isPacked: boolean;
};
type Item = {
  id: number;
  name: string;
  qtyNeeded: number | null;
  qtyLabel: string | null;
  isOptional: boolean;
  isOpenQuantity: boolean;
  notes: string | null;
  claims: Claim[];
  claimedTotal: number;
  remaining: number | null;
  isFull: boolean;
};
type Category = { id: number; name: string; items: Item[] };
type Payload = { categories: Category[] };

export default function GearPage() {
  const { data, isLoading, mutate } = useSWR<Payload>("/api/gear", fetcher, swrConfig);
  const { data: me } = useSWR<{ user: { id: number } }>("/api/me", fetcher, swrConfig);
  const myId = me?.user.id;

  async function setQty(item: Item, qty: number, el: Element | null) {
    if (!myId) return;

    // Optimistic: recompute this item locally exactly as the server will, so
    // the row updates on tap rather than after a round trip to Neon.
    const optimistic: Payload = {
      categories: (data?.categories ?? []).map((c) => ({
        ...c,
        items: c.items.map((it) => {
          if (it.id !== item.id) return it;
          const others = it.claims.filter((c2) => c2.userId !== myId);
          const mine = it.claims.find((c2) => c2.userId === myId);
          const claims =
            qty <= 0
              ? others
              : [...others, { ...(mine ?? { userId: myId, name: "", slug: "", avatarUrl: null, isPacked: false }), qty }];
          const total = claims.reduce((n, c2) => n + c2.qty, 0);
          return {
            ...it,
            claims,
            claimedTotal: total,
            remaining: it.isOpenQuantity ? null : Math.max((it.qtyNeeded ?? 1) - total, 0),
            isFull: it.isOpenQuantity ? claims.length > 0 : total >= (it.qtyNeeded ?? 1),
          };
        }),
      })),
    };

    try {
      await mutate(
        async () => {
          await send(`/api/gear/${item.id}/claim`, "POST", { qty });
          return fetcher<Payload>("/api/gear");
        },
        { optimisticData: optimistic, rollbackOnError: true, revalidate: false },
      );
      if (qty > 0 && qty > (item.claims.find((c) => c.userId === myId)?.qty ?? 0)) {
        burstFrom(el, { small: true });
      }
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "לא הצלחנו לעדכן");
    }
  }

  if (isLoading && !data) {
    return (
      <>
        <PageTitle title="ציוד" />
        <SkeletonList rows={6} />
      </>
    );
  }

  const all = data?.categories.flatMap((c) => c.items) ?? [];
  const required = all.filter((i) => !i.isOptional);
  const covered = required.filter((i) => i.isFull).length;

  return (
    <>
      <PageTitle
        title="ציוד"
        subtitle={`${covered} מתוך ${required.length} פריטים מכוסים`}
      />

      <div className="space-y-6">
        {data?.categories.map((cat) => (
          <section key={cat.id}>
            <h2 className="mb-2 px-1 text-sm font-semibold text-white/50">{cat.name}</h2>
            <div className="space-y-2">
              {cat.items.map((item) => (
                <GearRow
                  key={item.id}
                  item={item}
                  myId={myId}
                  onSetQty={(qty, el) => setQty(item, qty, el)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

function GearRow({
  item,
  myId,
  onSetQty,
}: {
  item: Item;
  myId?: number;
  onSetQty: (qty: number, el: Element | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const mine = myId ? item.claims.find((c) => c.userId === myId) : undefined;
  const myQty = mine?.qty ?? 0;
  const capacity = item.qtyNeeded ?? 1;
  const canAdd = item.isOpenQuantity || item.claimedTotal < capacity;

  const act = (qty: number) => (e: React.MouseEvent) => {
    setBusy(true);
    onSetQty(qty, e.currentTarget);
    setTimeout(() => setBusy(false), 350);
  };

  return (
    <motion.div
      layout
      className={cn(
        "glass rounded-2xl p-3.5 transition-colors",
        item.isFull && "border-aqua-400/25 bg-aqua-500/5",
      )}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold">{item.name}</span>
            {item.qtyLabel && (
              <span className="rounded-md bg-white/8 px-1.5 py-0.5 text-[11px] text-white/60">
                {item.qtyLabel}
              </span>
            )}
            {item.isOptional && (
              <span className="rounded-full border border-white/12 px-2 py-0.5 text-[10px] text-white/45">
                אופציונלי
              </span>
            )}
          </div>

          <div className="mt-1 text-xs text-white/45">
            {item.isOpenQuantity ? (
              item.claims.length > 0 ? (
                <span className="text-aqua-300">{item.claimedTotal} בדרך · תמיד אפשר עוד</span>
              ) : (
                "כמה שיותר — כל אחד יכול להביא"
              )
            ) : item.isFull ? (
              <span className="inline-flex items-center gap-1 text-aqua-300">
                <Check className="size-3.5" /> מכוסה
              </span>
            ) : (
              `נשאר ${item.remaining} מתוך ${capacity}`
            )}
            {item.notes && <span className="text-white/30"> · {item.notes}</span>}
          </div>
        </div>

        <AvatarStack entries={item.claims} />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <AnimatePresence mode="popLayout" initial={false}>
          {myQty > 0 ? (
            <motion.div
              key="stepper"
              layout
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="flex items-center gap-1 rounded-xl bg-brand-500/15 p-1"
            >
              <button
                aria-label="להוריד אחד"
                disabled={busy}
                onClick={act(myQty - 1)}
                className="tap grid place-items-center rounded-lg text-brand-200 active:bg-white/10"
              >
                <Minus className="size-4" />
              </button>
              <span className="min-w-6 text-center text-sm font-bold tabular-nums text-brand-100">
                {myQty}
              </span>
              <button
                aria-label="להוסיף אחד"
                disabled={busy || !canAdd}
                onClick={act(myQty + 1)}
                className="tap grid place-items-center rounded-lg text-brand-200 active:bg-white/10 disabled:opacity-30"
              >
                <Plus className="size-4" />
              </button>
            </motion.div>
          ) : (
            <motion.button
              key="claim"
              layout
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              disabled={busy || !canAdd}
              onClick={act(1)}
              className="tap flex items-center gap-1.5 rounded-xl border border-brand-400/30 bg-brand-500/15 px-4 text-sm font-semibold text-brand-200 transition active:scale-95 disabled:opacity-30"
            >
              <Sparkles className="size-4" />
              אני מביא
            </motion.button>
          )}
        </AnimatePresence>

        {myQty > 0 && (
          <button
            onClick={act(0)}
            disabled={busy}
            className="tap flex items-center gap-1 rounded-xl px-3 text-xs text-white/40 active:text-white/70"
          >
            <X className="size-3.5" />
            לוותר
          </button>
        )}
      </div>
    </motion.div>
  );
}
