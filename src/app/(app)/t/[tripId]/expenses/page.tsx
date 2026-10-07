"use client";

import { ArrowLeft, Check, Loader2, Pencil, Plus, Trash2, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import useSWR from "swr";

import { DonutChart, type DonutSlice } from "@/components/donut-chart";
import { Modal } from "@/components/modal";
import { PageTitle, SkeletonList } from "@/components/skeletons";
import { toast } from "@/components/toast";
import { UserAvatar } from "@/components/user-avatar";
import { ApiError, fetcher, send, swrConfig } from "@/lib/api";
import {
  amountToInput,
  categoryLabel,
  categoryOf,
  EXPENSE_CATEGORIES,
  formatMoney,
  parseAmount,
  splitEqually,
  type ExpenseCategory,
} from "@/lib/expenses";
import { useTrip } from "@/lib/trip-client";
import { cn } from "@/lib/utils";

type Member = { id: number; name: string; slug: string; avatarUrl: string | null };
type Expense = {
  id: number;
  description: string;
  amount: number;
  paidBy: number;
  createdAt: string;
  category: string;
  editedAt: string | null;
  shares: { userId: number; amount: number }[];
  canDelete: boolean;
  canEdit: boolean;
};
type Payload = {
  me: number;
  members: Member[];
  expenses: Expense[];
  settlements: {
    id: number;
    fromUser: number;
    toUser: number;
    amount: number;
    createdAt: string;
    canDelete: boolean;
  }[];
  balances: { userId: number; net: number }[];
  transfers: { from: number; to: number; amount: number }[];
};


export default function ExpensesPage() {
  const { api } = useTrip();
  const KEY = api("/expenses");
  const { data, isLoading, mutate } = useSWR<Payload>(KEY, fetcher, swrConfig);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const byId = useMemo(() => new Map(data?.members.map((m) => [m.id, m])), [data]);

  if (isLoading && !data) {
    return (
      <>
        <PageTitle title="הוצאות" />
        <SkeletonList rows={4} />
      </>
    );
  }
  if (!data) return null;

  const name = (id: number) => (id === data.me ? "אתה" : (byId.get(id)?.name ?? "?"));
  const myNet = data.balances.find((b) => b.userId === data.me)?.net ?? 0;

  async function run(key: string, fn: () => Promise<unknown>, failure: string) {
    setBusy(key);
    try {
      await fn();
      await mutate();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : failure);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageTitle
        title="הוצאות"
        subtitle="מי שילם על מה, ומי חייב למי"
        action={
          <button
            onClick={() => setAdding(true)}
            className="tap flex items-center gap-1.5 rounded-xl border border-brand-400/40 bg-brand-500/20 px-3.5 text-sm font-semibold text-brand-200 transition active:scale-95"
          >
            <Plus className="size-4" />
            הוצאה
          </button>
        }
      />

      {/* My position, in one sentence. */}
      <section className="glass glow-brand rounded-glass p-5 text-center">
        <p className="text-sm text-white/50">
          {myNet === 0 ? "אתה מסודר עם כולם" : myNet > 0 ? "חייבים לך" : "אתה חייב"}
        </p>
        <p
          className={cn(
            "mt-1 text-4xl font-bold tabular-nums",
            myNet > 0 ? "text-aqua-300" : myNet < 0 ? "text-brand-300" : "text-white/70",
          )}
        >
          {formatMoney(Math.abs(myNet))}
        </p>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 px-1 text-sm font-semibold text-white/50">להתחשבנות</h2>
        {data.transfers.length === 0 ? (
          <p className="glass rounded-2xl px-4 py-5 text-center text-sm text-aqua-300">
            הכול מסודר 🎉
          </p>
        ) : (
          <div className="space-y-2">
            {data.transfers.map((t) => {
              const key = `t-${t.from}-${t.to}`;
              const involvesMe = t.from === data.me || t.to === data.me;
              return (
                <div
                  key={key}
                  className={cn(
                    "glass flex items-center gap-3 rounded-2xl p-3",
                    involvesMe && "outline-2 outline-brand-400/40",
                  )}
                >
                  <PersonDot member={byId.get(t.from)} />
                  <ArrowLeft className="size-4 shrink-0 text-white/30" />
                  <PersonDot member={byId.get(t.to)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {name(t.from)} משלם ל{name(t.to) === "אתה" ? "ך" : name(t.to)}
                    </p>
                    <p className="text-lg font-bold tabular-nums">{formatMoney(t.amount)}</p>
                  </div>
                  <button
                    disabled={busy === key}
                    onClick={() =>
                      run(
                        key,
                        () => send(api("/settlements"), "POST", t),
                        "לא הצלחנו לסמן כשולם",
                      )
                    }
                    className="tap flex shrink-0 items-center gap-1.5 rounded-xl border border-aqua-400/40 bg-aqua-500/15 px-3 text-xs font-semibold text-aqua-200 transition active:scale-95 disabled:opacity-50"
                  >
                    {busy === key ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                    שולם
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-2 px-1 text-sm font-semibold text-white/50">יתרות</h2>
        <div className="glass divide-y divide-white/8 rounded-2xl">
          {data.balances.map((b) => (
            <div key={b.userId} className="flex items-center gap-3 px-3.5 py-2.5">
              <PersonDot member={byId.get(b.userId)} />
              <span className="min-w-0 flex-1 truncate text-sm">{byId.get(b.userId)?.name}</span>
              <span
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  b.net > 0 ? "text-aqua-300" : b.net < 0 ? "text-brand-300" : "text-white/35",
                )}
              >
                {b.net === 0 ? "—" : `${b.net > 0 ? "+" : "−"}${formatMoney(Math.abs(b.net))}`}
              </span>
            </div>
          ))}
        </div>
      </section>

      {data.expenses.length > 0 && <SpendingCard expenses={data.expenses} members={data.members} />}

      <section className="mt-6">
        <h2 className="mb-2 px-1 text-sm font-semibold text-white/50">
          כל ההוצאות ({data.expenses.length})
        </h2>
        {data.expenses.length === 0 ? (
          <p className="glass rounded-2xl px-4 py-5 text-center text-sm text-white/45">
            עוד לא נוספו הוצאות
          </p>
        ) : (
          <div className="space-y-2">
            {data.expenses.map((e) => {
              const mine = e.shares.find((s) => s.userId === data.me)?.amount;
              const key = `e-${e.id}`;
              return (
                <div key={e.id} className="glass rounded-2xl p-3.5">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{e.description}</p>
                      <p className="mt-0.5 text-xs text-white/45">
                        {categoryLabel(e.category)} · {name(e.paidBy)} שילם · חולק בין {e.shares.length}
                        {e.editedAt && " · נערך"}
                      </p>
                    </div>
                    <div className="shrink-0 text-end">
                      <p className="font-bold tabular-nums">{formatMoney(e.amount)}</p>
                      <p className="text-[11px] tabular-nums text-white/40">
                        {mine === undefined ? "לא חלק בזה" : `החלק שלך ${formatMoney(mine)}`}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center gap-2">
                    <div className="flex -space-x-2 rtl:space-x-reverse">
                      {e.shares.map((s) => {
                        const m = byId.get(s.userId);
                        return m ? (
                          <UserAvatar
                            key={s.userId}
                            name={m.name}
                            slug={m.slug}
                            avatarUrl={m.avatarUrl}
                            size={22}
                            title={`${m.name}: ${formatMoney(s.amount)}`}
                          />
                        ) : null;
                      })}
                    </div>
                    {e.canEdit && (
                      <button
                        onClick={() => setEditing(e)}
                        aria-label="עריכת הוצאה"
                        className="tap ms-auto grid place-items-center rounded-xl text-white/30 active:text-white"
                      >
                        <Pencil className="size-4" />
                      </button>
                    )}
                    {e.canDelete && (
                      <button
                        disabled={busy === key}
                        onClick={() => {
                          if (!confirm(`למחוק את "${e.description}"?`)) return;
                          void run(key, () => send(api(`/expenses/${e.id}`), "DELETE"), "לא הצלחנו למחוק");
                        }}
                        aria-label="מחיקת הוצאה"
                        className={cn(
                          "tap grid place-items-center rounded-xl text-white/30 active:text-red-300 disabled:opacity-50",
                          !e.canEdit && "ms-auto",
                        )}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {data.settlements.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 px-1 text-sm font-semibold text-white/50">תשלומים שסומנו</h2>
          <div className="glass divide-y divide-white/8 rounded-2xl">
            {data.settlements.map((s) => {
              const key = `s-${s.id}`;
              return (
                <div key={s.id} className="flex items-center gap-3 px-3.5 py-2.5 text-sm">
                  <span className="min-w-0 flex-1 truncate text-white/70">
                    {name(s.fromUser)} שילם ל{name(s.toUser) === "אתה" ? "ך" : name(s.toUser)}
                  </span>
                  <span className="font-semibold tabular-nums">{formatMoney(s.amount)}</span>
                  {s.canDelete && (
                    <button
                      disabled={busy === key}
                      onClick={() => run(key, () => send(api(`/settlements/${s.id}`), "DELETE"), "לא הצלחנו לבטל")}
                      aria-label="ביטול התשלום"
                      className="tap grid place-items-center text-white/30 active:text-white disabled:opacity-50"
                    >
                      <Undo2 className="size-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="הוצאה חדשה">
        <ExpenseForm
          members={data.members}
          meId={data.me}
          onDone={() => {
            setAdding(false);
            void mutate();
          }}
        />
      </Modal>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title="עריכת הוצאה">
        {editing && (
          <ExpenseForm
            key={editing.id}
            members={data.members}
            meId={data.me}
            initial={editing}
            onDone={() => {
              setEditing(null);
              void mutate();
            }}
          />
        )}
      </Modal>
    </>
  );
}

type View = "category" | "payer" | "share";

const VIEWS: { key: View; label: string }[] = [
  { key: "category", label: "קטגוריה" },
  { key: "payer", label: "מי שילם" },
  { key: "share", label: "החלק של כל אחד" },
];

const SERIES = 8;
const series = (slot: number) =>
  slot >= 0 && slot < SERIES ? `var(--color-series-${slot + 1})` : "var(--color-series-rest)";

/**
 * "Where the money went", three ways, all from the payload the page already
 * has, in integer agorot. By category and by payer each add up the expense
 * amounts; by share adds up everyone's stored share. All three come to the
 * same total, because the shares of an expense always sum to its amount.
 *
 * Colors follow the thing, never its rank: a category always has its slot,
 * and a person keeps their color between the payer and share views. Past
 * eight people, the rest fold into one gray "אחרים" slice rather than
 * reusing a color.
 */
function SpendingCard({ expenses, members }: { expenses: Expense[]; members: Member[] }) {
  const [view, setView] = useState<View>("category");

  const slices = useMemo<DonutSlice[]>(() => {
    const sums = new Map<string, number>();
    const add = (key: string, amount: number) => sums.set(key, (sums.get(key) ?? 0) + amount);
    const slot = new Map(members.map((m, i) => [m.id, i]));
    const personKey = (id: number) => ((slot.get(id) ?? SERIES) < SERIES ? `u${id}` : "rest");

    for (const e of expenses) {
      if (view === "category") add(categoryOf(e.category), e.amount);
      else if (view === "payer") add(personKey(e.paidBy), e.amount);
      else for (const s of e.shares) add(personKey(s.userId), s.amount);
    }

    const describe = (key: string): Omit<DonutSlice, "amount"> & { order: number } => {
      if (key === "rest") return { key, label: "אחרים", color: series(-1), order: SERIES };
      if (view === "category") {
        const i = EXPENSE_CATEGORIES.findIndex((c) => c.key === key);
        return { key, label: EXPENSE_CATEGORIES[i].label, color: series(i), order: i };
      }
      const id = Number(key.slice(1));
      const i = slot.get(id)!;
      return { key, label: members[i].name, color: series(i), order: i };
    };

    return [...sums]
      .map(([key, amount]) => ({ ...describe(key), amount }))
      .sort((a, b) =>
        a.key === "rest" ? 1 : b.key === "rest" ? -1 : b.amount - a.amount || a.order - b.order,
      );
  }, [expenses, members, view]);

  const title = VIEWS.find((v) => v.key === view)!.label;

  return (
    <section className="mt-6">
      <h2 className="mb-2 px-1 text-sm font-semibold text-white/50">לאן הלך הכסף</h2>
      <div className="glass rounded-2xl p-3.5">
        <div className="mb-4 flex rounded-xl border border-white/10 bg-white/5 p-1">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              aria-pressed={view === v.key}
              className={cn(
                "tap flex flex-1 items-center justify-center rounded-lg px-1 text-xs font-semibold transition",
                view === v.key ? "bg-brand-500/25 text-white" : "text-white/45",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
        <DonutChart key={view} slices={slices} label={`לאן הלך הכסף, לפי ${title}`} />
      </div>
    </section>
  );
}

function PersonDot({ member }: { member?: Member }) {
  if (!member) return <span className="size-8 shrink-0 rounded-full bg-white/10" />;
  return <UserAvatar name={member.name} slug={member.slug} avatarUrl={member.avatarUrl} size={32} />;
}

/**
 * Adds an expense, or with `initial` edits one: the same fields, filled in.
 * An edit sends only what changed, so fixing a typo never re-checks a payer
 * who has since left the trip.
 */
function ExpenseForm({
  members,
  meId,
  initial,
  onDone,
}: {
  members: Member[];
  meId: number;
  initial?: Expense;
  onDone: () => void;
}) {
  const { api } = useTrip();
  const [description, setDescription] = useState(initial?.description ?? "");
  const [amountText, setAmountText] = useState(initial ? amountToInput(initial.amount) : "");
  const [paidBy, setPaidBy] = useState(initial?.paidBy ?? meId);
  // Everyone by default: the common case is "we all shared this".
  const [shared, setShared] = useState<Set<number>>(
    () => new Set(initial ? initial.shares.map((s) => s.userId) : members.map((m) => m.id)),
  );
  const [category, setCategory] = useState<ExpenseCategory>(
    initial ? categoryOf(initial.category) : "other",
  );
  const [saving, setSaving] = useState(false);

  const amount = parseAmount(amountText);
  const preview = amount && shared.size > 0 ? splitEqually(amount, [...shared]) : null;
  const allSelected = members.every((m) => shared.has(m.id));

  function toggle(id: number) {
    setShared((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return toast("צריך לתאר את ההוצאה");
    if (!amount) return toast("סכום לא תקין");
    if (shared.size === 0) return toast("צריך לבחור עם מי לחלק");

    const body = { description: description.trim(), amount, paidBy, sharedWith: [...shared], category };

    setSaving(true);
    try {
      if (!initial) {
        await send(api("/expenses"), "POST", body);
      } else {
        const before = {
          description: initial.description,
          amount: initial.amount,
          paidBy: initial.paidBy,
          sharedWith: initial.shares.map((s) => s.userId),
          category: categoryOf(initial.category),
        };
        const same = (a: unknown, b: unknown) =>
          Array.isArray(a) && Array.isArray(b)
            ? a.length === b.length && a.every((id) => b.includes(id))
            : a === b;
        const changes = Object.fromEntries(
          Object.entries(body).filter(([k, v]) => !same(v, before[k as keyof typeof before])),
        );
        if (Object.keys(changes).length > 0) {
          await send(api(`/expenses/${initial.id}`), "PATCH", changes);
        }
      }
      onDone();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "לא הצלחנו לשמור");
      // Deleted on another device meanwhile: nothing left to edit, so close and refresh.
      if (err instanceof ApiError && err.status === 404) onDone();
      else setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <input
        autoFocus={!initial}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="על מה שילמו? (למשל: דלק)"
        maxLength={100}
        className="tap w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm outline-none placeholder:text-white/25 focus:border-brand-400/40"
      />

      <div className="relative">
        <input
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
          inputMode="decimal"
          placeholder="כמה עלה?"
          aria-label="סכום בשקלים"
          className="tap w-full rounded-xl border border-white/10 bg-white/5 px-3 pe-8 text-sm tabular-nums outline-none placeholder:text-white/25 focus:border-brand-400/40"
        />
        <span className="pointer-events-none absolute inset-y-0 end-3 grid place-items-center text-sm text-white/40">
          ₪
        </span>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold text-white/50">קטגוריה</p>
        <div className="flex flex-wrap gap-1.5">
          {EXPENSE_CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategory(c.key)}
              aria-pressed={category === c.key}
              className={cn(
                "tap flex items-center rounded-xl border px-3 text-xs font-semibold transition active:scale-95",
                category === c.key
                  ? "border-brand-400/40 bg-brand-500/20 text-brand-200"
                  : "border-white/10 bg-white/5 text-white/45",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold text-white/50">מי שילם?</p>
        <select
          value={paidBy}
          onChange={(e) => setPaidBy(Number(e.target.value))}
          className="tap w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm outline-none focus:border-brand-400/40"
        >
          {members.map((m) => (
            <option key={m.id} value={m.id} className="bg-night-800">
              {m.id === meId ? `${m.name} (אני)` : m.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="mb-1.5 flex items-center">
          <p className="flex-1 text-xs font-semibold text-white/50">מתחלקים בין</p>
          <button
            type="button"
            onClick={() => setShared(new Set(allSelected ? [] : members.map((m) => m.id)))}
            className="text-xs font-semibold text-brand-300"
          >
            {allSelected ? "נקה הכול" : "בחר הכול"}
          </button>
        </div>
        <div className="space-y-1.5">
          {members.map((m) => {
            const on = shared.has(m.id);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggle(m.id)}
                aria-pressed={on}
                className={cn(
                  "tap flex w-full items-center gap-3 rounded-xl border px-3 text-sm transition active:scale-[0.98]",
                  on ? "border-brand-400/40 bg-brand-500/15" : "border-white/10 bg-white/5 text-white/50",
                )}
              >
                <UserAvatar name={m.name} slug={m.slug} avatarUrl={m.avatarUrl} size={26} />
                <span className="flex-1 text-start">{m.name}</span>
                {on && preview?.has(m.id) && (
                  <span className="text-xs tabular-nums text-white/55">
                    {formatMoney(preview.get(m.id)!)}
                  </span>
                )}
                <span
                  className={cn(
                    "grid size-5 place-items-center rounded-md border",
                    on ? "border-brand-400/60 bg-brand-500/40 text-white" : "border-white/20 text-transparent",
                  )}
                >
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="tap flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-60"
      >
        {saving && <Loader2 className="size-4 animate-spin" />}
        שמירה
      </button>
    </form>
  );
}
