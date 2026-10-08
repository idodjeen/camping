"use client";

import { Check, ChevronDown, ExternalLink, Plus, Settings2, ShoppingCart, Trash2, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import useSWR from "swr";

import { KeptNames, PeopleField, field, inviteNote } from "@/components/admin-groups";
import { CopyButton } from "@/components/copy-button";
import { toast } from "@/components/toast";
import type { MemberRole } from "@/db/schema";
import { fetcher, send } from "@/lib/api";
import { parseCoords } from "@/lib/coords";
import { formatShortDate } from "@/lib/dates";
import type { AdminMember, AdminTrip, GroupDetail } from "@/lib/group-admin";
import type { InviteResult } from "@/lib/invite-email";
import { ROLE_LABEL, clashes, inviteMessage, parsePeople } from "@/lib/people";
import { cn } from "@/lib/utils";

type Me = { id: number; isSuperAdmin: boolean };
type Added = { added: number; kept: { email: string; typed: string; name: string }[]; invite: InviteResult };

const ROLES: readonly MemberRole[] = ["admin", "editor", "viewer"];
const label = "text-xs font-semibold text-white/60";
const errorText = (err: unknown) => (err instanceof Error ? err.message : "משהו השתבש");

/**
 * The group admin's screen: the group's trips (with who is on each, and a
 * new one), then its people (roles, removing, adding). `link` is the app's
 * own address, for the WhatsApp message.
 */
export function GroupAdmin({ initial, me, link }: { initial: GroupDetail; me: Me; link: string }) {
  const { data, mutate } = useSWR<GroupDetail>(`/api/g/${initial.group.id}`, fetcher, {
    fallbackData: initial,
    revalidateOnFocus: true,
  });
  const detail = data ?? initial;
  const refresh = () => void mutate();

  return (
    <div className="space-y-8">
      <Trips detail={detail} onChange={refresh} />
      <Members detail={detail} me={me} link={link} onChange={refresh} />
    </div>
  );
}

/* -------------------------------------------------------------------- trips */

function Trips({ detail, onChange }: { detail: GroupDetail; onChange: () => void }) {
  const empty = detail.trips.length === 0;
  const [creating, setCreating] = useState(empty);
  const viewers = detail.members.filter((m) => m.role === "viewer");

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-sm font-semibold text-white/50">טיולים ({detail.trips.length})</h2>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="tap flex items-center gap-1.5 rounded-xl bg-brand-500 px-3 text-xs font-bold text-white transition active:scale-95"
          >
            <Plus className="size-3.5" />
            טיול חדש
          </button>
        )}
      </div>

      {empty && (
        <p className="text-sm text-white/60">עוד אין טיול בקבוצה, ועד שיהיה, החברים רואים מסך ריק.</p>
      )}
      {creating && <NewTripForm detail={detail} onCancel={empty ? undefined : () => setCreating(false)} />}

      <ul className="space-y-2">
        {detail.trips.map((t) => (
          <TripCard key={t.id} trip={t} groupId={detail.group.id} members={detail.members} onChange={onChange} />
        ))}
      </ul>
      {!empty && viewers.length > 0 && (
        <p className="text-xs text-white/40">
          בצפייה בלבד, ולכן לא בטיולים: {viewers.map((v) => v.name).join(", ")}
        </p>
      )}
    </section>
  );
}

/** A trip's own fields as the forms hold them: text, before parsing. */
export type TripFieldsValue = { name: string; startDate: string; endDate: string; place: string; coordsText: string };

const EMPTY_TRIP: TripFieldsValue = { name: "", startDate: "", endDate: "", place: "", coordsText: "" };

/** Whether the fields are complete enough to send; the API checks them again. */
export function tripFieldsReady(v: TripFieldsValue) {
  const coords = v.coordsText.trim() ? parseCoords(v.coordsText) : null;
  return (
    v.name.trim() !== "" &&
    v.startDate !== "" &&
    v.endDate !== "" &&
    v.endDate >= v.startDate &&
    coords !== null &&
    !("error" in coords)
  );
}

/** The request body's share of the fields, as readTripDetails() expects them. */
export const tripFieldsBody = (v: TripFieldsValue) => ({
  name: v.name.trim(),
  startDate: v.startDate,
  endDate: v.endDate,
  locationName: v.place.trim(),
  coords: v.coordsText,
});

/**
 * Name, dates, place and map location: the fields of a new trip, and of
 * editing one on /t/[tripId]/manage. The location reads back as you type.
 */
export function TripFields({ value, onChange }: { value: TripFieldsValue; onChange: (v: TripFieldsValue) => void }) {
  const { name, startDate, endDate, place, coordsText } = value;
  const set = (patch: Partial<TripFieldsValue>) => onChange({ ...value, ...patch });
  const coords = coordsText.trim() ? parseCoords(coordsText) : null;
  const datesError = startDate && endDate && endDate < startDate ? "הטיול מסתיים לפני שהוא מתחיל" : null;

  return (
    <>
        <label className="block space-y-1.5">
          <span className={label}>שם הטיול</span>
          <input
            value={name}
            onChange={(e) => set({ name: e.target.value })}
            maxLength={60}
            placeholder="למשל: מחנאות 2027"
            className={field}
          />
        </label>

        <div className="flex gap-2">
          <label className="block min-w-0 flex-1 space-y-1.5">
            <span className={label}>מתאריך</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                const start = e.target.value;
                set({ startDate: start, endDate: !endDate || endDate < start ? start : endDate });
              }}
              className={field}
            />
          </label>
          <label className="block min-w-0 flex-1 space-y-1.5">
            <span className={label}>עד</span>
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => set({ endDate: e.target.value })}
              className={field}
            />
          </label>
        </div>
        {datesError && <p className="text-xs text-rose-300">{datesError}</p>}

        <label className="block space-y-1.5">
          <span className={label}>שם המקום (לא חובה)</span>
          <input
            value={place}
            onChange={(e) => set({ place: e.target.value })}
            maxLength={60}
            placeholder="למשל: חניון בית צידה"
            className={field}
          />
        </label>

        <label className="block space-y-1.5">
          <span className={label}>המיקום במפה</span>
          <input
            value={coordsText}
            onChange={(e) => set({ coordsText: e.target.value })}
            dir="ltr"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="32.79, 35.53"
            className={cn(field, "text-start")}
          />
          {coords === null ? (
            <span className="block text-xs text-white/40">
              קואורדינטות, או קישור מלא מגוגל מפות. במחשב: קליק ימני על הנקודה במפה, ולחיצה על המספרים מעתיקה אותם.
            </span>
          ) : "error" in coords ? (
            <span className="block text-xs text-rose-300">{coords.error}</span>
          ) : (
            <span className="flex items-center gap-2 text-xs">
              <Check className="size-3.5 shrink-0 text-aqua-400" />
              <span dir="ltr" className="text-white/70">
                {coords.lat}, {coords.lng}
              </span>
              <a
                href={`https://www.google.com/maps?q=${coords.lat},${coords.lng}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-brand-300"
              >
                לבדוק במפה
                <ExternalLink className="size-3" />
              </a>
            </span>
          )}
        </label>
    </>
  );
}

function NewTripForm({ detail, onCancel }: { detail: GroupDetail; onCancel?: () => void }) {
  const router = useRouter();
  const [trip, setTrip] = useState(EMPTY_TRIP);
  // An earlier trip of the group is the better start when there is one: it's their own list.
  const [from, setFrom] = useState(detail.trips[0] ? String(detail.trips[0].id) : "template");
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const source = detail.trips.find((t) => String(t.id) === from);
  const ready = tripFieldsReady(trip);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setServerError(null);
    try {
      const created = await send<{ trip: { id: number } }>(`/api/g/${detail.group.id}/trips`, "POST", {
        ...tripFieldsBody(trip),
        from: from === "template" ? "template" : Number(from),
      });
      toast(`הטיול "${trip.name.trim()}" נוצר`, "ok");
      router.push(`/t/${created.trip.id}`);
    } catch (err) {
      setServerError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="glass space-y-4 rounded-glass p-4">
      <div className="flex items-center gap-2">
        <h3 className="flex flex-1 items-center gap-2 font-bold">
          <Plus className="size-4 text-brand-300" />
          טיול חדש
        </h3>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            aria-label="ביטול"
            className="tap grid place-items-center rounded-xl text-white/45 active:text-white"
          >
            <X className="size-5" />
          </button>
        )}
      </div>

      <TripFields value={trip} onChange={setTrip} />

      <div className="space-y-1.5">
        {detail.trips.length > 0 ? (
          <label className="block space-y-1.5">
            <span className={label}>מתחילים מ</span>
            <select value={from} onChange={(e) => setFrom(e.target.value)} className={field}>
              {detail.trips.map((t) => (
                <option key={t.id} value={t.id} className="bg-night-800">
                  העתק של {t.name}
                </option>
              ))}
              <option value="template" className="bg-night-800">
                הרשימה הבסיסית
              </option>
            </select>
          </label>
        ) : (
          <span className={label}>מתחילים מהרשימה הבסיסית</span>
        )}
        <p className="text-xs text-white/45">
          {source
            ? `הציוד, הקניות והארוחות של "${source.name}", בלי מי לוקח מה ומה כבר נקנה. הארוחות זזות לתאריכים החדשים.`
            : "רשימת הציוד והקניות הבסיסית, בלי ארוחות."}
        </p>
      </div>

      <p className="text-xs text-white/45">
        כל המנהלים והחברים מצטרפים לטיול, ומי שיוצר/ת אותו אחראי/ת על הקניות. אפשר לשנות אחר כך.
      </p>

      {serverError && (
        <p className="whitespace-pre-line rounded-xl bg-rose-500/10 p-3 text-xs text-rose-200">{serverError}</p>
      )}

      <button
        type="submit"
        disabled={!ready || busy}
        className="tap flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-40"
      >
        {busy ? "יוצרים..." : "יצירת הטיול"}
      </button>
    </form>
  );
}

function TripCard({
  trip,
  groupId,
  members,
  onChange,
}: {
  trip: AdminTrip;
  groupId: number;
  members: AdminMember[];
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const going = members.filter((m) => m.role !== "viewer");
  const onTrip = new Map(trip.people.map((p) => [p.userId, p.isShopper]));
  const count = going.filter((m) => onTrip.has(m.userId)).length;

  return (
    <li className="glass rounded-glass">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="tap flex w-full items-center gap-3 p-4 text-start"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{trip.name}</span>
          <span className="block truncate text-xs text-white/50">
            {/* dir=ltr keeps the range in date order inside RTL text. */}
            <span dir="ltr">
              {formatShortDate(trip.startDate)} – {formatShortDate(trip.endDate)}
            </span>
            {" · "}
            {count === 1 ? "משתתף/ת אחד/ת" : `${count} משתתפים`}
            {trip.ended && " · הסתיים"}
          </span>
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-white/35 transition", open && "rotate-180")} />
      </button>

      {open && (
        <div className="space-y-3 border-t border-white/10 p-4">
          <ul className="space-y-1">
            {going.map((m) => (
              <TripPersonRow
                key={m.userId}
                member={m}
                tripName={trip.name}
                url={`/api/g/${groupId}/trips/${trip.id}/members/${m.userId}`}
                onTrip={onTrip.has(m.userId)}
                isShopper={onTrip.get(m.userId) ?? false}
                onChange={onChange}
              />
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/t/${trip.id}`}
              className="tap inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-semibold text-white/60 transition active:scale-95"
            >
              לטיול
            </Link>
            <Link
              href={`/t/${trip.id}/manage`}
              className="tap inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-semibold text-white/60 transition active:scale-95"
            >
              <Settings2 className="size-3.5" />
              עריכת הטיול
            </Link>
          </div>
        </div>
      )}
    </li>
  );
}

function TripPersonRow({
  member,
  tripName,
  url,
  onTrip,
  isShopper,
  onChange,
}: {
  member: AdminMember;
  tripName: string;
  url: string;
  onTrip: boolean;
  isShopper: boolean;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function set(change: { onTrip?: boolean; isShopper?: boolean }) {
    if (change.onTrip === false && !confirm(`להוריד את ${member.name} מ"${tripName}"? הציוד שלקח/ה שם ישוחרר.`)) {
      return;
    }
    setBusy(true);
    try {
      await send(url, "PATCH", change);
      onChange();
    } catch (err) {
      toast(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex items-center gap-2">
      <button
        role="checkbox"
        aria-checked={onTrip}
        disabled={busy}
        onClick={() => set({ onTrip: !onTrip })}
        className="tap flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-1 text-start text-sm transition disabled:opacity-50"
      >
        <span
          className={cn(
            "grid size-5 shrink-0 place-items-center rounded-md border",
            onTrip ? "border-brand-400 bg-brand-500 text-white" : "border-white/20",
          )}
        >
          {onTrip && <Check className="size-3.5" />}
        </span>
        <span className={cn("truncate font-semibold", onTrip ? "text-white/85" : "text-white/40")}>
          {member.name}
        </span>
      </button>
      {onTrip && (
        <button
          aria-pressed={isShopper}
          aria-label={`${member.name} בקניות`}
          disabled={busy}
          onClick={() => set({ isShopper: !isShopper })}
          className={cn(
            "tap flex shrink-0 items-center gap-1 rounded-xl px-2.5 text-xs font-semibold transition disabled:opacity-50",
            isShopper ? "bg-aqua-400/15 text-aqua-300" : "text-white/35",
          )}
        >
          <ShoppingCart className="size-3.5" />
          קניות
        </button>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ members */

function Members({
  detail,
  me,
  link,
  onChange,
}: {
  detail: GroupDetail;
  me: Me;
  link: string;
  onChange: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState<Added | null>(null);

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-sm font-semibold text-white/50">אנשים ({detail.members.length})</h2>
        <CopyButton getText={() => inviteMessage(detail.group.name, link)} label="הודעת הזמנה" />
      </div>

      {added ? (
        <AddedCard added={added} message={inviteMessage(detail.group.name, link)} onDone={() => setAdded(null)} />
      ) : adding ? (
        <AddPeopleForm
          detail={detail}
          onCancel={() => setAdding(false)}
          onAdded={(a) => {
            setAdded(a);
            setAdding(false);
            onChange();
          }}
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="tap flex w-full items-center justify-center gap-2 rounded-glass border border-dashed border-white/15 text-sm font-semibold text-white/60 transition active:scale-[0.99]"
        >
          <UserPlus className="size-4" />
          הוספת אנשים
        </button>
      )}

      <ul className="glass divide-y divide-white/5 rounded-glass">
        {detail.members.map((m) => (
          <MemberRow key={m.userId} member={m} me={me} groupId={detail.group.id} onChange={onChange} />
        ))}
      </ul>
    </section>
  );
}

function MemberRow({
  member,
  me,
  groupId,
  onChange,
}: {
  member: AdminMember;
  me: Me;
  groupId: number;
  onChange: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const isMe = member.userId === me.id;
  const url = `/api/g/${groupId}/members/${member.userId}`;
  // Stepping down from admin takes away this very page, unless you're the super admin.
  const leavesPage = (role: MemberRole) => isMe && role !== "admin" && !me.isSuperAdmin;

  async function changeRole(role: MemberRole) {
    if (
      role === "viewer" &&
      !confirm(`להעביר את ${member.name} לצפייה בלבד? זה מוריד אותו/ה מהטיולים של הקבוצה ומשחרר את הציוד שלקח/ה.`)
    ) {
      return;
    }
    if (leavesPage(role) && !confirm("אחרי זה כבר לא תוכל/י לנהל את הקבוצה. להמשיך?")) return;

    setBusy(true);
    try {
      await send(url, "PATCH", { role });
      toast(`${member.name}: ${ROLE_LABEL[role]}`, "ok");
      if (leavesPage(role)) router.replace("/");
      else onChange();
    } catch (err) {
      toast(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`להסיר את ${member.name} מהקבוצה? זה מוריד אותו/ה גם מכל הטיולים שלה.`)) return;
    setBusy(true);
    try {
      await send(url, "DELETE");
      toast(`${member.name} הוסר/ה מהקבוצה`, "ok");
      onChange();
    } catch (err) {
      toast(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex items-center gap-2 p-3">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-white/85">
          {member.name}
          {isMe && <span className="font-normal text-white/40"> (אני)</span>}
        </span>
        <span dir="ltr" className="block truncate text-start text-xs text-white/40">
          {member.email}
        </span>
      </span>
      <select
        value={member.role}
        disabled={busy}
        onChange={(e) => changeRole(e.target.value as MemberRole)}
        aria-label={`התפקיד של ${member.name}`}
        className="tap shrink-0 rounded-xl border border-white/10 bg-white/5 px-2 text-xs font-semibold outline-none focus:border-brand-400/40 disabled:opacity-50"
      >
        {ROLES.map((r) => (
          <option key={r} value={r} className="bg-night-800">
            {ROLE_LABEL[r]}
          </option>
        ))}
      </select>
      {/* Nobody removes themselves; the empty slot keeps the selects in one column. */}
      {isMe ? (
        <span aria-hidden className="tap shrink-0" />
      ) : (
        <button
          onClick={remove}
          disabled={busy}
          aria-label={`להסיר את ${member.name}`}
          className="tap grid shrink-0 place-items-center rounded-xl text-white/35 transition active:text-rose-300 disabled:opacity-50"
        >
          <Trash2 className="size-4" />
        </button>
      )}
    </li>
  );
}

function AddPeopleForm({
  detail,
  onAdded,
  onCancel,
}: {
  detail: GroupDetail;
  onAdded: (a: Added) => void;
  onCancel: () => void;
}) {
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const parsed = useMemo(() => parsePeople(text), [text]);
  const inGroup = new Map(detail.members.map((m) => [m.email, m.name]));
  const fine = parsed.filter((p) => !p.error);
  // Against everyone already in the group too. Someone with a row from another
  // group keeps their stored name, which only the server knows; it re-checks.
  const problems = [
    ...fine.filter((p) => inGroup.has(p.email)).map((p) => `${p.email} כבר בקבוצה (בשם ${inGroup.get(p.email)})`),
    ...clashes([
      ...detail.members.map(({ email, name }) => ({ email, name })),
      ...fine.filter((p) => !inGroup.has(p.email)),
    ]),
  ];
  const ready = parsed.length > 0 && fine.length === parsed.length && problems.length === 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setServerError(null);
    try {
      const result = await send<Added>(`/api/g/${detail.group.id}/members`, "POST", {
        role,
        people: parsed.map(({ email, name }) => ({ email, name })),
      });
      onAdded(result);
    } catch (err) {
      setServerError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="glass space-y-4 rounded-glass p-4">
      <div className="flex items-center gap-2">
        <h3 className="flex flex-1 items-center gap-2 font-bold">
          <UserPlus className="size-4 text-brand-300" />
          הוספת אנשים
        </h3>
        <button
          type="button"
          onClick={onCancel}
          aria-label="ביטול"
          className="tap grid place-items-center rounded-xl text-white/45 active:text-white"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="space-y-1.5">
        <div role="radiogroup" aria-label="מוסיפים בתור" className="flex gap-1 rounded-xl bg-white/5 p-1">
          {(["editor", "viewer"] as const).map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={role === r}
              onClick={() => setRole(r)}
              className={cn(
                "tap flex-1 rounded-lg text-sm font-semibold transition",
                role === r ? "bg-brand-500/20 text-brand-200" : "text-white/50",
              )}
            >
              {r === "editor" ? "חברים" : "צפייה בלבד"}
            </button>
          ))}
        </div>
        <p className="text-xs text-white/45">
          {role === "editor"
            ? "מצטרפים לכל טיול שעוד לא הסתיים, ויכולים לערוך."
            : "רואים הכול ולא עורכים. לא בטיולים ולא בחשבון ההוצאות."}
        </p>
      </div>

      <PeopleField label="מייל ושם, אחד בכל שורה" value={text} onChange={setText} parsed={parsed} />

      {problems.length > 0 && (
        <ul className="space-y-0.5 text-xs text-rose-300">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      {serverError && (
        <p className="whitespace-pre-line rounded-xl bg-rose-500/10 p-3 text-xs text-rose-200">{serverError}</p>
      )}

      <button
        type="submit"
        disabled={!ready || busy}
        className="tap flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-40"
      >
        {busy ? "מוסיפים..." : "הוספה לקבוצה"}
      </button>
    </form>
  );
}

/** Right after adding: the message to paste into the group's WhatsApp. */
function AddedCard({ added, message, onDone }: { added: Added; message: string; onDone: () => void }) {
  return (
    <section className="glass space-y-3 rounded-glass p-4">
      <h3 className="font-bold">{added.added === 1 ? "נוסף/ה אדם אחד ✅" : `נוספו ${added.added} אנשים ✅`}</h3>
      <p className="text-sm text-white/60">{inviteNote(added.invite)}</p>
      <KeptNames kept={added.kept} />
      <p className="rounded-xl bg-white/5 p-3 text-sm leading-relaxed whitespace-pre-line text-white/80">{message}</p>
      <div className="flex gap-2">
        <CopyButton getText={() => message} label="העתקה לוואטסאפ" />
        <button
          onClick={onDone}
          className="tap rounded-xl px-3 text-xs font-semibold text-white/50 transition active:scale-95"
        >
          סגירה
        </button>
      </div>
    </section>
  );
}
