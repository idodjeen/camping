"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, Minus, Plus, Sparkles, X } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";

import { AvatarStack } from "@/components/avatar-stack";
import { CommentsButton } from "@/components/comments";
import { CopyButton } from "@/components/copy-button";
import { PageTitle, SkeletonList } from "@/components/skeletons";
import { toast } from "@/components/toast";
import { ApiError, fetcher, send, swrConfig } from "@/lib/api";
import { burstFrom } from "@/lib/confetti";
import { formatGearList } from "@/lib/format-lists";
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
  commentCount: number;
};
type Category = { id: number; name: string; items: Item[] };
type Payload = { categories: Category[] };

export default function GearPage() {
  const { data, isLoading, mutate } = useSWR<Payload>("/api/gear", fetcher, swrConfig);
  const { data: me } = useSWR<{ user: { id: number } }>("/api/me", fetcher, swrConfig);
  const myId = me?.user.id;
  const [flashId, setFlashId] = useState<number | null>(null);

  async function setQty(item: Item, qty: number, el: Element | null) {
    if (!myId) return;

    const current = item.claims.find((c) => c.userId === myId)?.qty ?? 0;
    const isTakingMore = qty > 0 && qty > current;

    // Celebrate on the tap itself rather than after the round-trip to Neon.
    // The row already updates optimistically, so waiting for the server made
    // the confetti arrive detached from the press — it read as nothing having
    // happened, then something random happening. The rare cost is a burst for
    // a claim that loses the race for the last unit, which the toast explains.
    if (isTakingMore) {
      burstFrom(el);
      setFlashId(item.id);
      setTimeout(() => setFlashId((id) => (id === item.id ? null : id)), 700);
    }

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
        action={<CopyButton getText={() => formatGearList(data?.categories ?? [])} />}
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
                  flash={flashId === item.id}
                  onSetQty={(qty, el) => setQty(item, qty, el)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <AddGearItem
        categories={data?.categories.map((c) => ({ id: c.id, name: c.name })) ?? []}
        onAdded={() => mutate()}
      />
    </>
  );
}

/** Any member can add something the list is missing. */
function AddGearItem({
  categories,
  onAdded,
}: {
  categories: { id: number; name: string }[];
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !categoryId) return;
    setBusy(true);
    try {
      await send("/api/gear", "POST", { name: name.trim(), categoryId, qtyNeeded: qty });
      setName("");
      setQty(1);
      setOpen(false);
      onAdded();
      toast("נוסף לרשימה", "ok");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "לא הצלחנו להוסיף");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="tap mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 px-5 text-sm font-semibold text-white/45 transition active:scale-[0.98]"
      >
        <Plus className="size-4" />
        להוסיף פריט חסר
      </button>
    );
  }

  return (
    <motion.form
      onSubmit={submit}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass mt-6 space-y-3 rounded-2xl p-4"
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="מה חסר?"
        maxLength={80}
        className="tap w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm outline-none placeholder:text-white/25 focus:border-brand-400/40"
      />
      <div className="flex gap-2">
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(Number(e.target.value))}
          className="tap min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 text-sm outline-none focus:border-brand-400/40"
        >
          <option value="">קטגוריה…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id} className="bg-night-800">
              {c.name}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          max={99}
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
          aria-label="כמות"
          className="tap w-16 rounded-xl border border-white/10 bg-white/5 px-3 text-center text-sm outline-none focus:border-brand-400/40"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy || !name.trim() || !categoryId}
          className="tap flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-500/25 text-sm font-semibold text-brand-100 transition active:scale-95 disabled:opacity-30"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          להוסיף
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="tap rounded-xl px-4 text-sm text-white/45"
        >
          ביטול
        </button>
      </div>
    </motion.form>
  );
}

function GearRow({
  item,
  myId,
  flash,
  onSetQty,
}: {
  item: Item;
  myId?: number;
  flash?: boolean;
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
        flash && "claim-pulse",
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

        <span className="ms-auto">
          <CommentsButton subject="gear" id={item.id} count={item.commentCount} name={item.name} />
        </span>

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
