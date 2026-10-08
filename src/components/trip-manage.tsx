"use client";

import { ArrowDown, ArrowUp, Check, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import useSWR from "swr";

import { field } from "@/components/admin-groups";
import { TripFields, tripFieldsBody, tripFieldsReady, type TripFieldsValue } from "@/components/group-admin";
import { Modal } from "@/components/modal";
import { PageTitle, SkeletonList } from "@/components/skeletons";
import { toast } from "@/components/toast";
import { ApiError, fetcher, send } from "@/lib/api";
import { SLOT_LABELS, addDays, daysUntil, formatTripDay } from "@/lib/dates";
import { useTrip } from "@/lib/trip-client";
import type { ListKind, ManageView } from "@/lib/trip-content";
import { cn } from "@/lib/utils";

type Meal = ManageView["meals"][number];
type Slot = Meal["slot"];

const SLOTS: Slot[] = ["breakfast", "lunch", "dinner"];
const SLOT_EMOJI = { breakfast: "☕️", lunch: "🔥", dinner: "🌙" } as const;
const label = "text-xs font-semibold text-white/60";
const errorText = (err: unknown) => (err instanceof Error ? err.message : "משהו השתבש");

/** Every day of the trip, capped so a mistyped year can't render a thousand days. */
function tripDays(start: string, end: string) {
  const days: string[] = [];
  for (let d = start; d <= end && days.length < 60; d = addDays(d, 1)) days.push(d);
  return days;
}

/**
 * The group admin's screen inside a trip: its details, its meals by day, and
 * its gear and shopping categories. The other screens only show what this one
 * changes, so editors keep exactly what they had. The API answers 403 to
 * everyone else, and so does this page.
 */
export function TripManage() {
  const { api } = useTrip();
  const { data, error, mutate } = useSWR<ManageView>(api("/manage"), fetcher, {
    revalidateOnFocus: true,
    keepPreviousData: true,
    shouldRetryOnError: false,
  });

  if (error instanceof ApiError && error.status === 403) {
    return (
      <div className="glass rounded-glass p-8 text-center">
        <h1 className="text-xl font-bold">אין הרשאה</h1>
        <p className="mt-2 text-sm text-white/60">הדף הזה רק למנהלי הקבוצה.</p>
      </div>
    );
  }
  if (!data) {
    return (
      <>
        <PageTitle title="ניהול הטיול" />
        <SkeletonList rows={4} />
      </>
    );
  }

  const refresh = () => void mutate();
  const t = data.trip;
  return (
    <>
      <PageTitle title="ניהול הטיול" subtitle="פרטים, ארוחות וקטגוריות. רק מנהלי הקבוצה רואים את הדף הזה." />
      <div className="space-y-8">
        {/* Keyed by the saved values, so the form starts over whenever they change. */}
        <Details key={`${t.name}|${t.startDate}|${t.endDate}|${t.locationName}|${t.lat}|${t.lng}`} trip={t} onSaved={refresh} />
        <Meals data={data} onChange={refresh} />
        <Categories kind="gear" title="קטגוריות ציוד" categories={data.gear} onChange={refresh} />
        <Categories kind="shopping" title="קטגוריות קניות" categories={data.shopping} onChange={refresh} />
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ details */

function Details({ trip, onSaved }: { trip: ManageView["trip"]; onSaved: () => void }) {
  const { api } = useTrip();
  const router = useRouter();
  const initial: TripFieldsValue = {
    name: trip.name,
    startDate: trip.startDate,
    endDate: trip.endDate,
    place: trip.locationName ?? "",
    coordsText: `${trip.lat}, ${trip.lng}`,
  };
  const [value, setValue] = useState(initial);
  const [shiftMeals, setShiftMeals] = useState(true);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const dirty = (Object.keys(initial) as (keyof TripFieldsValue)[]).some((k) => value[k] !== initial[k]);
  const moved = value.startDate && value.startDate !== trip.startDate ? daysUntil(value.startDate, trip.startDate) : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty || !tripFieldsReady(value) || busy) return;
    setBusy(true);
    setServerError(null);
    try {
      const { shifted } = await send<{ shifted: number }>(api("/manage"), "PATCH", {
        ...tripFieldsBody(value),
        shiftMeals: moved !== 0 && shiftMeals,
      });
      toast(shifted > 0 ? `נשמר, ו-${shifted} ארוחות זזו איתו` : "נשמר", "ok");
      onSaved();
      // The header's trip name and the home card come from the server.
      router.refresh();
    } catch (err) {
      setServerError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="glass space-y-4 rounded-glass p-4">
      <h2 className="font-bold">פרטי הטיול</h2>
      <TripFields value={value} onChange={setValue} />
      {moved !== 0 && (
        <label className="flex items-start gap-2.5 text-sm text-white/75">
          <input
            type="checkbox"
            checked={shiftMeals}
            onChange={(e) => setShiftMeals(e.target.checked)}
            className="mt-0.5 size-4 accent-brand-500"
          />
          <span>
            להזיז גם את הארוחות {Math.abs(moved) === 1 ? "ביום אחד" : `ב-${Math.abs(moved)} ימים`}{" "}
            {moved > 0 ? "קדימה" : "אחורה"}
          </span>
        </label>
      )}
      {serverError && (
        <p className="whitespace-pre-line rounded-xl bg-rose-500/10 p-3 text-xs text-rose-200">{serverError}</p>
      )}
      <button
        type="submit"
        disabled={!dirty || !tripFieldsReady(value) || busy}
        className="tap flex w-full items-center justify-center rounded-xl bg-brand-500 px-4 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-40"
      >
        {busy ? "שומרים..." : "שמירה"}
      </button>
    </form>
  );
}

/* -------------------------------------------------------------------- meals */

type Editing = { meal?: Meal; date: string; slot: Slot };

function Meals({ data, onChange }: { data: ManageView; onChange: () => void }) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const days = tripDays(data.trip.startDate, data.trip.endDate);
  const bySlot = new Map(data.meals.map((m) => [`${m.date} ${m.slot}`, m]));
  // Only possible for data from before this screen existed; listed so it can be fixed.
  const outside = data.meals.filter((m) => m.date < data.trip.startDate || m.date > data.trip.endDate);

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-white/50">ארוחות</h2>
      {days.map((day) => (
        <div key={day} className="glass rounded-glass p-3">
          <h3 className="mb-1.5 px-1 text-sm font-semibold text-brand-300">{formatTripDay(day)}</h3>
          <ul className="space-y-1">
            {SLOTS.map((slot) => (
              <MealRow
                key={slot}
                meal={bySlot.get(`${day} ${slot}`)}
                slot={slot}
                onEdit={(meal) => setEditing({ meal, date: day, slot })}
                onChange={onChange}
              />
            ))}
          </ul>
        </div>
      ))}
      {outside.length > 0 && (
        <div className="glass rounded-glass p-3">
          <h3 className="mb-1.5 px-1 text-sm font-semibold text-rose-300">מחוץ לתאריכי הטיול</h3>
          <ul className="space-y-1">
            {outside.map((m) => (
              <MealRow key={m.id} meal={m} slot={m.slot} onEdit={() => setEditing({ meal: m, date: m.date, slot: m.slot })} onChange={onChange} />
            ))}
          </ul>
        </div>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing?.meal ? "עריכת ארוחה" : "ארוחה חדשה"}>
        {editing && (
          <MealForm
            data={data}
            editing={editing}
            days={days}
            onDone={() => {
              setEditing(null);
              onChange();
            }}
          />
        )}
      </Modal>
    </section>
  );
}

function MealRow({
  meal,
  slot,
  onEdit,
  onChange,
}: {
  meal: Meal | undefined;
  slot: Slot;
  onEdit: (meal: Meal | undefined) => void;
  onChange: () => void;
}) {
  const { api } = useTrip();
  const [busy, setBusy] = useState(false);

  if (!meal) {
    return (
      <li>
        <button
          onClick={() => onEdit(undefined)}
          className="tap flex w-full items-center gap-2 rounded-xl px-2 text-start text-sm text-white/35 transition active:bg-white/5"
        >
          <Plus className="size-4 shrink-0" />
          {SLOT_LABELS[slot]}
        </button>
      </li>
    );
  }

  async function remove() {
    if (!meal) return;
    const thread = meal.comments === 0 ? "" : meal.comments === 1 ? " גם התגובה עליה תימחק." : ` גם ${meal.comments} התגובות עליה יימחקו.`;
    if (!confirm(`למחוק את "${meal.title}"?${thread}`)) return;
    setBusy(true);
    try {
      await send(api(`/manage/meals/${meal.id}`), "DELETE");
      toast(`"${meal.title}" נמחקה`, "ok");
      onChange();
    } catch (err) {
      toast(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex items-center gap-1">
      <button
        onClick={() => onEdit(meal)}
        disabled={busy}
        className="tap flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 text-start transition active:bg-white/5 disabled:opacity-50"
      >
        <span aria-hidden>{SLOT_EMOJI[slot]}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-white/85">{meal.title}</span>
          <span className="block truncate text-xs text-white/40">
            {SLOT_LABELS[slot]}
            {meal.itemIds.length > 0 && ` · ${meal.itemIds.length === 1 ? "מצרך אחד" : `${meal.itemIds.length} מצרכים`}`}
          </span>
        </span>
        <Pencil className="size-4 shrink-0 text-white/30" />
      </button>
      <button
        onClick={remove}
        disabled={busy}
        aria-label={`למחוק את ${meal.title}`}
        className="tap grid shrink-0 place-items-center rounded-xl text-white/30 transition active:text-rose-300 disabled:opacity-50"
      >
        <Trash2 className="size-4" />
      </button>
    </li>
  );
}

function MealForm({
  data,
  editing,
  days,
  onDone,
}: {
  data: ManageView;
  editing: Editing;
  days: string[];
  onDone: () => void;
}) {
  const { api } = useTrip();
  const { meal } = editing;
  const [title, setTitle] = useState(meal?.title ?? "");
  const [description, setDescription] = useState(meal?.description ?? "");
  const [date, setDate] = useState(editing.date);
  const [slot, setSlot] = useState<Slot>(editing.slot);
  const [selected, setSelected] = useState(() => new Set(meal?.itemIds ?? []));
  const [newItems, setNewItems] = useState<{ name: string; categoryId: number }[]>([]);
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState(data.shopping[0]?.id ?? 0);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const taken = data.meals.find((m) => m.date === date && m.slot === slot && m.id !== meal?.id);
  const byName = useMemo(() => new Map(data.shoppingItems.map((i) => [i.name, i.id])), [data.shoppingItems]);
  const query = search.trim();
  const groups = data.shopping
    .map((c) => ({
      ...c,
      items: data.shoppingItems.filter((i) => i.categoryId === c.id && (!query || i.name.includes(query))),
    }))
    .filter((c) => c.items.length > 0);

  const toggle = (id: number) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  function addNew() {
    const name = newName.trim();
    if (!name) return;
    // Already on the list: just pick it.
    const existing = byName.get(name);
    if (existing) setSelected((cur) => new Set(cur).add(existing));
    else if (!newItems.some((n) => n.name === name)) setNewItems((cur) => [...cur, { name, categoryId: newCategory }]);
    setNewName("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || taken || busy) return;
    setBusy(true);
    setServerError(null);
    try {
      const body = { date, slot, title: title.trim(), description: description.trim(), itemIds: [...selected], newItems };
      if (meal) await send(api(`/manage/meals/${meal.id}`), "PATCH", body);
      else await send(api("/manage/meals"), "POST", body);
      toast(meal ? "הארוחה עודכנה" : "הארוחה נוספה", "ok");
      onDone();
    } catch (err) {
      setServerError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block space-y-1.5">
        <span className={label}>מה אוכלים</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="למשל: שקשוקה" className={field} />
      </label>

      <label className="block space-y-1.5">
        <span className={label}>תיאור (לא חובה)</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          rows={2}
          className={cn(field, "min-h-16 py-2 leading-relaxed")}
        />
      </label>

      <div className="flex gap-2">
        <label className="block min-w-0 flex-1 space-y-1.5">
          <span className={label}>יום</span>
          <select value={date} onChange={(e) => setDate(e.target.value)} className={field}>
            {(days.includes(date) ? days : [date, ...days]).map((d) => (
              <option key={d} value={d} className="bg-night-800">
                {formatTripDay(d)}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-0 flex-1 space-y-1.5">
          <span className={label}>ארוחה</span>
          <select value={slot} onChange={(e) => setSlot(e.target.value as Slot)} className={field}>
            {SLOTS.map((s) => (
              <option key={s} value={s} className="bg-night-800">
                {SLOT_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {taken && <p className="text-xs text-rose-300">בזמן הזה כבר יש ארוחה: {taken.title}</p>}

      <fieldset className="space-y-2">
        <legend className={cn(label, "mb-1.5")}>
          מצרכים מרשימת הקניות{selected.size + newItems.length > 0 && ` (${selected.size + newItems.length})`}
        </legend>
        <div className="relative">
          <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-white/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש"
            aria-label="חיפוש מצרך"
            className={cn(field, "ps-9")}
          />
        </div>
        <div className="max-h-56 space-y-2 overflow-y-auto">
          {groups.map((c) => (
            <div key={c.id}>
              <p className="mb-1 text-[11px] font-semibold text-white/40">{c.name}</p>
              <div className="flex flex-wrap gap-1.5">
                {c.items.map((i) => {
                  const on = selected.has(i.id);
                  return (
                    <button
                      key={i.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(i.id)}
                      className={cn(
                        "flex min-h-8 items-center gap-1 rounded-lg px-2 text-xs transition",
                        on ? "bg-brand-500/25 text-brand-100" : "bg-white/6 text-white/55",
                      )}
                    >
                      {on && <Check className="size-3" strokeWidth={3} />}
                      {i.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {groups.length === 0 && <p className="text-xs text-white/40">לא נמצא ברשימה. אפשר להוסיף אותו כאן למטה.</p>}
        </div>

        {newItems.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {newItems.map((n) => (
              <span key={n.name} className="flex min-h-8 items-center gap-1 rounded-lg bg-aqua-500/12 px-2 text-xs text-aqua-200">
                {n.name} (חדש)
                <button
                  type="button"
                  aria-label={`לבטל את ${n.name}`}
                  onClick={() => setNewItems((cur) => cur.filter((x) => x.name !== n.name))}
                >
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
        {data.shopping.length > 0 && (
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addNew();
                }
              }}
              maxLength={80}
              placeholder="מצרך שאין ברשימה"
              aria-label="מצרך חדש"
              className={cn(field, "min-w-0 flex-1")}
            />
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(Number(e.target.value))}
              aria-label="הקטגוריה של המצרך החדש"
              className={cn(field, "w-28 shrink-0")}
            >
              {data.shopping.map((c) => (
                <option key={c.id} value={c.id} className="bg-night-800">
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addNew}
              disabled={!newName.trim()}
              aria-label="הוספה"
              className="tap grid shrink-0 place-items-center rounded-xl bg-white/8 text-white/70 disabled:opacity-40"
            >
              <Plus className="size-4" />
            </button>
          </div>
        )}
      </fieldset>

      {serverError && (
        <p className="whitespace-pre-line rounded-xl bg-rose-500/10 p-3 text-xs text-rose-200">{serverError}</p>
      )}
      <button
        type="submit"
        disabled={!title.trim() || Boolean(taken) || busy}
        className="tap flex w-full items-center justify-center rounded-xl bg-brand-500 px-4 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-40"
      >
        {busy ? "שומרים..." : meal ? "שמירה" : "הוספת הארוחה"}
      </button>
    </form>
  );
}

/* --------------------------------------------------------------- categories */

function Categories({
  kind,
  title,
  categories,
  onChange,
}: {
  kind: ListKind;
  title: string;
  categories: ManageView["gear"];
  onChange: () => void;
}) {
  const { api } = useTrip();
  const base = api(`/manage/categories/${kind}`);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState("");

  /** Runs one change and refreshes; false when it failed (the toast says why). */
  async function run(action: () => Promise<unknown>, ok?: string) {
    setBusy(true);
    try {
      await action();
      if (ok) toast(ok, "ok");
      onChange();
      return true;
    } catch (err) {
      toast(errorText(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  function move(index: number, by: -1 | 1) {
    const ids = categories.map((c) => c.id);
    [ids[index], ids[index + by]] = [ids[index + by], ids[index]];
    void run(() => send(base, "PATCH", { ids }));
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    const name = adding.trim();
    if (!name) return;
    void run(async () => {
      await send(base, "POST", { name });
      setAdding("");
    }, `נוספה הקטגוריה ${name}`);
  }

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-white/50">{title}</h2>
      <ul className="glass divide-y divide-white/5 rounded-glass">
        {categories.map((c, i) => (
          <CategoryRow
            key={c.id}
            category={c}
            busy={busy}
            first={i === 0}
            last={i === categories.length - 1}
            onMove={(by) => move(i, by)}
            onRename={(name) => run(() => send(`${base}/${c.id}`, "PATCH", { name }), "השם עודכן")}
            onDelete={() => {
              if (confirm(`למחוק את הקטגוריה ${c.name}?`)) void run(() => send(`${base}/${c.id}`, "DELETE"), "הקטגוריה נמחקה");
            }}
          />
        ))}
        <li className="p-2">
          <form onSubmit={add} className="flex gap-2">
            <input
              value={adding}
              onChange={(e) => setAdding(e.target.value)}
              maxLength={40}
              placeholder="קטגוריה חדשה"
              aria-label={`קטגוריה חדשה ב${title}`}
              className={cn(field, "min-w-0 flex-1")}
            />
            <button
              type="submit"
              disabled={busy || !adding.trim()}
              className="tap shrink-0 rounded-xl bg-white/8 px-3 text-xs font-semibold text-white/70 disabled:opacity-40"
            >
              הוספה
            </button>
          </form>
        </li>
      </ul>
    </section>
  );
}

function CategoryRow({
  category,
  busy,
  first,
  last,
  onMove,
  onRename,
  onDelete,
}: {
  category: ManageView["gear"][number];
  busy: boolean;
  first: boolean;
  last: boolean;
  onMove: (by: -1 | 1) => void;
  onRename: (name: string) => Promise<boolean>;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const iconButton = "tap grid shrink-0 place-items-center rounded-xl text-white/35 transition active:text-white disabled:opacity-25";

  if (editing !== null) {
    return (
      <li className="p-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const name = editing.trim();
            if (!name || name === category.name) return setEditing(null);
            void onRename(name).then((saved) => saved && setEditing(null));
          }}
          className="flex gap-2"
        >
          <input
            value={editing}
            onChange={(e) => setEditing(e.target.value)}
            maxLength={40}
            autoFocus
            aria-label={`השם החדש של ${category.name}`}
            className={cn(field, "min-w-0 flex-1")}
          />
          <button type="submit" disabled={busy} aria-label="שמירה" className={iconButton}>
            <Check className="size-4" />
          </button>
          <button type="button" onClick={() => setEditing(null)} aria-label="ביטול" className={iconButton}>
            <X className="size-4" />
          </button>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-1 p-2">
      <span className="min-w-0 flex-1 px-1">
        <span className="block truncate text-sm font-semibold text-white/85">{category.name}</span>
        <span className="block text-xs text-white/40">
          {category.items === 0 ? "ריקה" : category.items === 1 ? "פריט אחד" : `${category.items} פריטים`}
        </span>
      </span>
      <button onClick={() => onMove(-1)} disabled={busy || first} aria-label={`להזיז את ${category.name} למעלה`} className={iconButton}>
        <ArrowUp className="size-4" />
      </button>
      <button onClick={() => onMove(1)} disabled={busy || last} aria-label={`להזיז את ${category.name} למטה`} className={iconButton}>
        <ArrowDown className="size-4" />
      </button>
      <button onClick={() => setEditing(category.name)} disabled={busy} aria-label={`לשנות את השם של ${category.name}`} className={iconButton}>
        <Pencil className="size-4" />
      </button>
      {/* Only an empty category can go; the API says why otherwise. */}
      <button
        onClick={onDelete}
        disabled={busy || category.items > 0}
        aria-label={category.items > 0 ? `${category.name} לא ריקה, ולכן אי אפשר למחוק אותה` : `למחוק את ${category.name}`}
        className={iconButton}
      >
        <Trash2 className="size-4" />
      </button>
    </li>
  );
}
