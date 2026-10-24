"use client";

import { motion } from "framer-motion";
import {
  Armchair,
  AtSign,
  Check,
  CookingPot,
  Droplet,
  Flame,
  Lightbulb,
  Minus,
  Moon,
  Package,
  Plus,
  Tent,
  Undo2,
  WifiOff,
} from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";

import { CommentsButton } from "@/components/comments";
import { CopyButton } from "@/components/copy-button";
import { FilterChips } from "@/components/filter-chips";
import { Modal } from "@/components/modal";
import { MyGearList, type MyClaim } from "@/components/my-gear-list";
import { PersonalList } from "@/components/personal-list";
import { SkeletonList } from "@/components/skeletons";
import { toast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Field, TextField, inputClass } from "@/components/ui/controls";
import { Badge, EmptyState, ErrorState, IconTile } from "@/components/ui/surfaces";
import type { Tone } from "@/components/ui/tone";
import { UserAvatar } from "@/components/user-avatar";
import { ApiError, fetcher, send, swrConfig } from "@/lib/api";
import { burstFrom } from "@/lib/confetti";
import { formatGearList, formatMyList } from "@/lib/format-lists";
import { markTap } from "@/lib/tap-timer";
import { useTrip, useTripName } from "@/lib/trip-client";
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
  unreadMentions: number;
};
type Category = { id: number; name: string; items: Item[] };
type Payload = { categories: Category[] };
type Me = {
  user: { id: number; name: string; isViewer: boolean };
  claims: MyClaim[];
  personal: { id: number; name: string; isPacked: boolean; qty: number | null }[];
};

/** What each filter in the URL shows. `done` has no chip: the home screen's ring links to it. */
const SHOWS: Record<string, (i: Item) => boolean> = {
  todo: (i) => !i.isFull,
  done: (i) => i.isFull,
  mentions: (i) => i.unreadMentions > 0,
};

export default function GearPage() {
  const { api } = useTrip();
  const tripName = useTripName();
  const { data, error, isLoading, mutate } = useSWR<Payload>(api("/gear"), fetcher, swrConfig);
  const { data: me } = useSWR<Me>(api("/me"), fetcher, swrConfig);
  const myId = me?.user.id;
  // Viewers see no take or add buttons. Until /me answers nobody does, so a
  // viewer never sees a button flash in and vanish.
  const canEdit = me ? !me.user.isViewer : false;
  const [flashId, setFlashId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  // The filter lives in the URL so the dashboard rings can link straight into
  // a filtered view, and so the view survives a refresh or a shared link.
  const filter = useSearchParams().get("filter");

  async function setQty(item: Item, qty: number, el: Element | null) {
    if (!myId) return;

    const current = item.claims.find((c) => c.userId === myId)?.qty ?? 0;
    const isTakingMore = qty > 0 && qty > current;

    // Celebrate on the tap itself rather than after the round-trip to Neon.
    // The row already updates optimistically, so waiting for the server made
    // the confetti arrive detached from the press: it read as nothing having
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
          await send(api(`/gear/${item.id}/claim`), "POST", { qty });
          return fetcher<Payload>(api("/gear"));
        },
        { optimisticData: optimistic, rollbackOnError: true, revalidate: false },
      );
    } catch (err) {
      // The server says why, kindly: someone took the last one first, or you can only view.
      toast(err instanceof ApiError ? err.message : "לא הצלחנו לעדכן");
    }
  }

  if (!data) {
    if (error && !isLoading) {
      return (
        <ErrorState
          icon={<WifiOff />}
          title="לא הצלחנו לטעון את הציוד"
          body="בדקו את החיבור ונסו שוב."
          onRetry={() => mutate()}
        />
      );
    }
    return (
      <>
        <div className="mb-4 h-[104px] animate-pulse rounded-[30px] bg-rose" aria-hidden />
        <SkeletonList rows={6} />
      </>
    );
  }

  const all = data.categories.flatMap((c) => c.items);
  const required = all.filter((i) => !i.isOptional);
  const covered = required.filter((i) => i.isFull).length;
  const missing = all.filter((i) => !i.isFull).length;
  const tagged = all.filter((i) => i.unreadMentions > 0).length;
  const isMyView = filter === "mine" || filter === "personal";
  const shows = (filter && SHOWS[filter]) || (() => true);
  const hasItems = all.length > 0;

  const copy =
    isMyView ? (
      <CopyButton
        round
        label="שיתוף הרשימה שלי"
        getText={() =>
          formatMyList(
            me?.user.name ?? "",
            filter === "mine" ? (me?.claims ?? []) : [],
            filter === "personal" ? (me?.personal ?? []) : [],
          )
        }
      />
    ) : (
      <CopyButton round label="שיתוף רשימת הציוד" getText={() => formatGearList(data.categories, { tripName })} />
    );

  return (
    <>
      <GearHero covered={covered} total={required.length} />

      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <FilterChips
            current={filter}
            options={[
              { key: null, label: "הכל", count: all.length },
              { key: "todo", label: "חסר", count: missing },
              { key: "mine", label: "אני מביא", count: me?.claims.length },
              { key: "personal", label: "הרשימה שלי", count: me?.personal.length },
              // Only offered when there is something to find, so the row of
              // chips does not grow a permanently empty option.
              ...(tagged > 0 ? [{ key: "mentions", label: "תייגו אותך", count: tagged, tone: "alert" as const }] : []),
            ]}
          />
        </div>
        {copy}
      </div>

      {filter === "mine" && <MyGearList />}
      {filter === "personal" && <PersonalList />}

      {/* Kept mounted under the personal views, so going back is instant. */}
      <div className={cn("flex flex-col gap-7", isMyView && "hidden", canEdit && hasItems && "pb-16")}>
        {!hasItems ? (
          <EmptyState
            icon={<Package />}
            tone="rose"
            title="עוד אין ציוד ברשימה"
            body={canEdit ? "מה צריך להביא לטיול? אפשר להתחיל מהפריט הראשון." : "כשיוסיפו ציוד, הוא יופיע כאן."}
            action={
              canEdit && (
                <Button size="sm" icon={<Plus className="size-5" />} onClick={() => setAdding(true)}>
                  פריט חדש
                </Button>
              )
            }
          />
        ) : (
          <GearSections
            categories={data.categories}
            shows={shows}
            filter={filter}
            myId={myId}
            canEdit={canEdit}
            flashId={flashId}
            onSetQty={setQty}
          />
        )}
      </div>

      {canEdit && hasItems && !isMyView && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--bottom-nav-h)+0.75rem)] z-20 mx-auto flex w-full max-w-md justify-end px-4">
          <Button
            icon={<Plus className="size-5" strokeWidth={2.4} />}
            onClick={() => setAdding(true)}
            className="pointer-events-auto px-5 shadow-[0_8px_24px_var(--c-shadow)]"
          >
            פריט חדש
          </Button>
        </div>
      )}

      {canEdit && (
        <AddGearSheet
          open={adding}
          onClose={() => setAdding(false)}
          categories={data.categories.map((c) => ({ id: c.id, name: c.name }))}
          onAdded={() => mutate()}
        />
      )}
    </>
  );
}

/** The rose card at the top: how much of the required gear is covered. */
function GearHero({ covered, total }: { covered: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((covered / total) * 100);
  const r = 34;
  const circumference = 2 * Math.PI * r;

  return (
    <section className="mb-4 flex items-center gap-4 rounded-[30px] bg-rose px-[18px] py-4">
      <div className="relative size-[72px] shrink-0">
        <svg viewBox="0 0 80 80" className="size-full -rotate-90" aria-hidden>
          <circle cx="40" cy="40" r={r} fill="none" stroke="var(--c-canvas)" strokeWidth="9" />
          {pct > 0 && (
            <circle
              cx="40"
              cy="40"
              r={r}
              fill="none"
              stroke="var(--c-rose-strong)"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - pct / 100)}
              className="transition-[stroke-dashoffset] duration-700 ease-out"
            />
          )}
        </svg>
        <span className="absolute inset-0 grid place-items-center font-display text-lg" dir="ltr">
          {pct}%
        </span>
      </div>
      <div className="min-w-0 flex-1 leading-tight">
        <h1 className="font-display text-[28px]">ציוד</h1>
        <p className="mt-0.5 text-[15px] text-rose-ink">
          <span dir="ltr">{covered}</span> מתוך <span dir="ltr">{total}</span> פריטים מכוסים
        </p>
      </div>
    </section>
  );
}

/**
 * "מחכים למישהו" first, then "כבר מכוסה", each grouped by category. Under a
 * filter a section with nothing in it is left out; when that leaves nothing,
 * an empty state says why.
 */
function GearSections({
  categories,
  shows,
  filter,
  myId,
  canEdit,
  flashId,
  onSetQty,
}: {
  categories: Category[];
  shows: (i: Item) => boolean;
  filter: string | null;
  myId?: number;
  canEdit: boolean;
  flashId: number | null;
  onSetQty: (item: Item, qty: number, el: Element | null) => void;
}) {
  const path = usePathname();
  const pick = (full: boolean) =>
    categories
      .map((c, index) => ({ ...c, index, items: c.items.filter((i) => i.isFull === full && shows(i)) }))
      .filter((c) => c.items.length > 0);
  const waiting = pick(false);
  const done = pick(true);

  const showAll = () => {
    markTap(path, "chip");
    window.history.pushState(null, "", path);
  };

  if (waiting.length === 0 && done.length === 0) {
    return filter === "todo" ? (
      <EmptyState icon={<Check />} tone="sage" title="כל הציוד מכוסה" body="אין פריט שמחכה למישהו." />
    ) : (
      <EmptyState
        icon={filter === "mentions" ? <AtSign /> : <Package />}
        tone="rose"
        title={filter === "mentions" ? "אין תיוגים שמחכים לך" : "עוד לא כוסה כלום"}
        action={
          <Button variant="secondary" size="sm" onClick={showAll}>
            לכל הציוד
          </Button>
        }
      />
    );
  }

  const row = (item: Item, index: number, name: string) => (
    <GearRow
      key={item.id}
      item={item}
      tile={categoryTile(name, index)}
      myId={myId}
      canEdit={canEdit}
      flash={flashId === item.id}
      onSetQty={(qty, el) => onSetQty(item, qty, el)}
    />
  );

  return (
    <>
      {(waiting.length > 0 || filter === null) && (
        <GearSection title="מחכים למישהו" groups={waiting} row={row}>
          {waiting.length === 0 && (
            <p className="flex items-center justify-center gap-2 rounded-card bg-sage px-4 py-5 text-[15px] font-bold text-sage-ink">
              <Check className="size-5" aria-hidden />
              כל הציוד מכוסה
            </p>
          )}
        </GearSection>
      )}
      {done.length > 0 && <GearSection title="כבר מכוסה" groups={done} row={row} />}
    </>
  );
}

function GearSection({
  title,
  groups,
  row,
  children,
}: {
  title: string;
  groups: (Category & { index: number })[];
  row: (item: Item, index: number, name: string) => React.ReactNode;
  children?: React.ReactNode;
}) {
  const count = groups.reduce((n, g) => n + g.items.length, 0);
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="font-display text-lg">{title}</h2>
        {count > 0 && (
          <span className="text-sm text-muted">
            {count === 1 ? (
              "פריט אחד"
            ) : (
              <>
                <span dir="ltr">{count}</span> פריטים
              </>
            )}
          </span>
        )}
      </div>
      {children}
      {groups.map((g) => (
        <div key={g.id} className="flex flex-col gap-2.5">
          <h3 className="mt-1 px-1.5 text-[13px] font-bold text-muted">{g.name}</h3>
          {g.items.map((item) => row(item, g.index, g.name))}
        </div>
      ))}
    </section>
  );
}

const TONES: Tone[] = ["peach", "amber", "rose", "sage", "coral"];
const ICONS: [RegExp, React.ReactNode][] = [
  [/מדור|אש|גריל|פחם/, <Flame key="f" />],
  [/מטבח|בישול|אוכל|כלים/, <CookingPot key="k" />],
  [/ישיבה|אווירה|כיסא/, <Armchair key="a" />],
  [/שינה|לינה|מזרן|שק/, <Moon key="m" />],
  [/אוהל|מחנה|צל/, <Tent key="t" />],
  [/תאורה|פנס|חשמל/, <Lightbulb key="l" />],
  [/מים|שתי/, <Droplet key="d" />],
];

/** A category's tile: an icon guessed from its name, and a colour by its place in the list. */
function categoryTile(name: string, index: number): { tone: Tone; icon: React.ReactNode } {
  const icon = ICONS.find(([re]) => re.test(name))?.[1] ?? <Package />;
  return { tone: TONES[index % TONES.length], icon };
}

function GearRow({
  item,
  tile,
  myId,
  canEdit,
  flash,
  onSetQty,
}: {
  item: Item;
  tile: { tone: Tone; icon: React.ReactNode };
  myId?: number;
  canEdit: boolean;
  flash?: boolean;
  onSetQty: (qty: number, el: Element | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const mine = myId ? item.claims.find((c) => c.userId === myId) : undefined;
  const myQty = mine?.qty ?? 0;
  const others = item.claims.filter((c) => c.userId !== myId);
  const capacity = item.qtyNeeded ?? 1;
  const canAdd = item.isOpenQuantity || item.claimedTotal < capacity;
  // A stepper only where more than one can be brought.
  const multi = item.isOpenQuantity || capacity > 1;
  const isMine = canEdit && myQty > 0;

  const act = (qty: number) => (e: React.MouseEvent) => {
    setBusy(true);
    onSetQty(qty, e.currentTarget);
    setTimeout(() => setBusy(false), 350);
  };

  const names = others.length > 0 && (
    <>
      {isMine ? "גם " : ""}
      {others[0].name}
      {others.length > 1 && <span dir="ltr"> +{others.length - 1}</span>}
    </>
  );

  const status = item.isOpenQuantity ? (
    item.claims.length > 0 ? (
      <>
        <span dir="ltr">{item.claimedTotal}</span> בדרך, תמיד אפשר עוד
      </>
    ) : (
      "כמה שיותר, כל אחד יכול להביא"
    )
  ) : item.isFull ? (
    <>
      <span dir="ltr">{item.claimedTotal}</span> מתוך <span dir="ltr">{capacity}</span>
    </>
  ) : (
    <>
      נשאר <span dir="ltr">{item.remaining}</span> מתוך <span dir="ltr">{capacity}</span>
    </>
  );

  let trailing: React.ReactNode = null;
  let bringers = false;
  if (isMine) {
    trailing = (
      <Badge tone="sage">
        <Check className="size-3.5" strokeWidth={2.6} aria-hidden />
        אתה מביא
      </Badge>
    );
  } else if (canEdit && canAdd) {
    trailing = (
      <Button size="sm" disabled={busy} onClick={act(1)}>
        אני מביא
      </Button>
    );
  } else if (item.isFull && others.length > 0) {
    trailing = <Bringers people={others} />;
    bringers = true;
  }

  // Names go under the title when the end of the row is busy with something else.
  const namesInStatus = names && !bringers;

  return (
    <motion.div
      layout="position"
      className={cn(
        "rounded-[24px] border-[1.5px] bg-surface py-3 ps-3 pe-3",
        // A question addressed to you is the most urgent thing about the row.
        item.unreadMentions > 0 ? "border-cta" : "border-line",
        flash && "claim-pulse",
      )}
    >
      <div className="flex items-center gap-3">
        <IconTile tone={tile.tone}>{tile.icon}</IconTile>
        <div className="min-w-0 flex-1 leading-snug">
          <p className="text-base font-bold">
            {item.name}
            {item.qtyLabel && <span className="font-normal text-muted"> · {item.qtyLabel}</span>}
          </p>
          <p className="text-[13px] text-muted">
            {status}
            {namesInStatus && <> · {names}</>}
            {item.notes && <> · {item.notes}</>}
          </p>
          {(item.isOptional || item.unreadMentions > 0) && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {item.unreadMentions > 0 && (
                <Badge tone="rose">
                  <AtSign className="size-3.5" aria-hidden />
                  תייגו אותך
                </Badge>
              )}
              {item.isOptional && <Badge tone="amber">אופציונלי</Badge>}
            </div>
          )}
        </div>
        <CommentsButton
          subject="gear"
          id={item.id}
          count={item.commentCount}
          name={item.name}
          unread={item.unreadMentions}
        />
        {trailing}
      </div>

      {isMine && (
        <div className="mt-2 flex items-center gap-2 ps-14">
          {multi && (
            <div className="flex items-center rounded-full bg-sage text-sage-ink">
              <button
                type="button"
                aria-label="להוריד אחד"
                disabled={busy}
                onClick={act(myQty - 1)}
                className="grid size-11 place-items-center rounded-full transition active:scale-90 disabled:opacity-45"
              >
                <Minus className="size-4" strokeWidth={2.6} />
              </button>
              <span dir="ltr" className="min-w-6 text-center font-display text-base">
                {myQty}
              </span>
              <button
                type="button"
                aria-label="להוסיף אחד"
                disabled={busy || !canAdd}
                onClick={act(myQty + 1)}
                className="grid size-11 place-items-center rounded-full transition active:scale-90 disabled:opacity-45"
              >
                <Plus className="size-4" strokeWidth={2.6} />
              </button>
            </div>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={act(0)}
            className="tap inline-flex items-center gap-1.5 rounded-full px-3 text-sm font-bold text-muted transition active:scale-95 disabled:opacity-45"
          >
            <Undo2 className="size-[18px]" aria-hidden />
            לוותר
          </button>
        </div>
      )}
    </motion.div>
  );
}

/** Who brings a covered item: the first one's avatar and name, "+N" for the rest, and a tick. */
function Bringers({ people }: { people: Claim[] }) {
  const first = people[0];
  return (
    <div className="flex shrink-0 items-center gap-2">
      <UserAvatar name={first.name} slug={first.slug} avatarUrl={first.avatarUrl} size={30} />
      <span className="max-w-20 truncate text-sm text-muted">
        {first.name}
        {people.length > 1 && <span dir="ltr"> +{people.length - 1}</span>}
      </span>
      <span aria-hidden className="grid size-[30px] place-items-center rounded-full bg-sage text-sage-ink">
        <Check className="size-4" strokeWidth={2.6} />
      </span>
    </div>
  );
}

/** Editors add something the list is missing, in the bottom sheet. */
function AddGearSheet({
  open,
  onClose,
  categories,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  categories: { id: number; name: string }[];
  onAdded: () => void;
}) {
  const { api } = useTrip();
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const chosen = categoryId || (categories.length === 1 ? categories[0].id : "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !chosen) return;
    setBusy(true);
    try {
      await send(api("/gear"), "POST", { name: name.trim(), categoryId: chosen, qtyNeeded: qty });
      setName("");
      setQty(1);
      onClose();
      onAdded();
      toast("נוסף לרשימה", "ok");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "לא הצלחנו להוסיף");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="פריט חדש">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextField
          label="מה צריך להביא?"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="למשל: פנס ראש"
          maxLength={80}
        />
        <div className="flex gap-3">
          <Field
            label="קטגוריה"
            htmlFor="gear-category"
            className="flex-1"
            hint={categories.length === 0 ? "אין עדיין קטגוריות. מנהלי הטיול מוסיפים אותן בהגדרות." : undefined}
          >
            <select
              id="gear-category"
              value={chosen}
              onChange={(e) => setCategoryId(Number(e.target.value))}
              className={cn(inputClass, "h-[52px]")}
            >
              <option value="">בחרו קטגוריה</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="כמה" htmlFor="gear-qty" className="w-24">
            <input
              id="gear-qty"
              type="number"
              inputMode="numeric"
              dir="ltr"
              min={1}
              max={99}
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
              className={cn(inputClass, "h-[52px] text-center")}
            />
          </Field>
        </div>
        <Button
          type="submit"
          full
          busy={busy}
          busyLabel="מוסיפים..."
          disabled={!name.trim() || !chosen}
          icon={<Plus className="size-5" />}
        >
          להוסיף לרשימה
        </Button>
      </form>
    </Modal>
  );
}
