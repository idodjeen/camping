"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { Check, Loader2, Lock, Plus } from "lucide-react";
import useSWR from "swr";

import { CommentsButton } from "@/components/comments";
import { CopyButton } from "@/components/copy-button";
import { PageTitle, SkeletonList } from "@/components/skeletons";
import { toast } from "@/components/toast";
import { UserAvatar } from "@/components/user-avatar";
import { ApiError, fetcher, send, swrConfig } from "@/lib/api";
import { burstFrom } from "@/lib/confetti";
import { formatShoppingList } from "@/lib/format-lists";
import { SLOT_LABELS, formatTripDay } from "@/lib/dates";
import { cn } from "@/lib/utils";

type Item = {
  id: number;
  name: string;
  quantityText: string | null;
  notes: string | null;
  isBought: boolean;
  boughtBy: { name: string; slug: string; avatarUrl: string | null } | null;
  commentCount: number;
  meals: { id: number; title: string; date: string; slot: string }[];
};
type Payload = { categories: { id: number; name: string; items: Item[] }[]; canBuy: boolean };

export default function ShoppingPage() {
  const { data, isLoading, mutate } = useSWR<Payload>("/api/shopping", fetcher, swrConfig);

  async function toggle(item: Item, el: Element | null) {
    if (!data?.canBuy) return;
    const next = !item.isBought;

    // Fire on the tap, not after the server confirms — see the note in
    // gear/page.tsx. The row updates optimistically either way.
    if (next) burstFrom(el);

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
      <PageTitle
        title="קניות"
        subtitle={`${bought} מתוך ${all.length} נקנו`}
        action={<CopyButton getText={() => formatShoppingList(data?.categories ?? [])} />}
      />

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

                    <CommentsButton
                      subject="shopping"
                      id={item.id}
                      count={item.commentCount}
                      name={item.name}
                    />

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

      <AddShoppingItem
        categories={data?.categories.map((c) => ({ id: c.id, name: c.name })) ?? []}
        onAdded={() => mutate()}
      />
    </>
  );
}

/**
 * Anyone can add a missing item — noticing the gap is not a privileged act.
 * Only marking something bought stays restricted to is_shopper.
 */
function AddShoppingItem({
  categories,
  onAdded,
}: {
  categories: { id: number; name: string }[];
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [qtyText, setQtyText] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !categoryId) return;
    setBusy(true);
    try {
      await send("/api/shopping", "POST", {
        name: name.trim(),
        categoryId,
        quantityText: qtyText.trim() || undefined,
      });
      setName("");
      setQtyText("");
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
        להוסיף פריט לרשימה
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
        placeholder="מה חסר? (חומוס, קרח…)"
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
          value={qtyText}
          onChange={(e) => setQtyText(e.target.value)}
          placeholder="כמות"
          maxLength={40}
          className="tap w-24 rounded-xl border border-white/10 bg-white/5 px-3 text-center text-sm outline-none placeholder:text-white/25 focus:border-brand-400/40"
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
