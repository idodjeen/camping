"use client";

import { Check, ChevronDown, Plus, UserCog, Users, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import useSWR from "swr";

import { CopyButton } from "@/components/copy-button";
import { toast } from "@/components/toast";
import { fetcher, send } from "@/lib/api";
import type { GroupSummary } from "@/lib/groups";
import {
  ROLE_LABEL,
  clashes,
  inviteMessage,
  isEmail,
  nameProblem,
  parsePeople,
  type ParsedLine,
} from "@/lib/people";
import { cn } from "@/lib/utils";

const KEY = "/api/admin/groups";

export const field =
  "tap w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm outline-none placeholder:text-white/25 focus:border-brand-400/40";

type Created = {
  group: { id: number; name: string };
  kept: { email: string; typed: string; name: string }[];
};

/**
 * The super admin's screen: every group, and a form that creates one with its
 * admin, editors and viewers. `link` is the app's own address, for the
 * WhatsApp message.
 */
export function AdminGroups({ initial, link }: { initial: GroupSummary[]; link: string }) {
  const { data, mutate } = useSWR<{ groups: GroupSummary[] }>(KEY, fetcher, {
    fallbackData: { groups: initial },
    revalidateOnFocus: true,
  });
  const [created, setCreated] = useState<Created | null>(null);

  return (
    <div className="space-y-6">
      {created ? (
        <CreatedCard created={created} link={link} onDone={() => setCreated(null)} />
      ) : (
        <NewGroupForm
          onCreated={(c) => {
            setCreated(c);
            void mutate();
          }}
        />
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-white/50">
          כל הקבוצות ({data?.groups.length ?? 0})
        </h2>
        <ul className="space-y-2">
          {data?.groups.map((g) => (
            <GroupCard key={g.id} group={g} link={link} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function NewGroupForm({ onCreated }: { onCreated: (c: Created) => void }) {
  const [name, setName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [editorsText, setEditorsText] = useState("");
  const [viewersText, setViewersText] = useState("");
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const editors = useMemo(() => parsePeople(editorsText), [editorsText]);
  const viewers = useMemo(() => parsePeople(viewersText), [viewersText]);

  const email = adminEmail.trim().toLowerCase();
  const adminEmailError = adminEmail && !isEmail(email) ? "המייל לא תקין" : null;
  const adminNameError = adminName ? nameProblem(adminName) : null;

  const everyone = [
    { email, name: adminName.trim() },
    ...editors.filter((p) => !p.error),
    ...viewers.filter((p) => !p.error),
  ];
  const listClashes = clashes(everyone.filter((p) => p.email));
  const ready =
    name.trim() !== "" &&
    isEmail(email) &&
    !nameProblem(adminName) &&
    [...editors, ...viewers].every((p) => !p.error) &&
    listClashes.length === 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setServerError(null);
    try {
      const strip = (list: ParsedLine[]) => list.map(({ email, name }) => ({ email, name }));
      const result = await send<Created>(KEY, "POST", {
        name: name.trim(),
        admin: { email, name: adminName.trim() },
        editors: strip(editors),
        viewers: strip(viewers),
      });
      toast(`הקבוצה "${result.group.name}" נוצרה`, "ok");
      onCreated(result);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "משהו השתבש");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="glass space-y-4 rounded-glass p-4">
      <h2 className="flex items-center gap-2 font-bold">
        <Plus className="size-4 text-brand-300" />
        קבוצה חדשה
      </h2>

      <label className="block space-y-1.5">
        <span className="text-xs font-semibold text-white/60">שם הקבוצה</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder="למשל: החבר׳ה מהצבא"
          className={field}
        />
      </label>

      <fieldset className="space-y-1.5">
        <legend className="mb-1.5 text-xs font-semibold text-white/60">מנהל/ת הקבוצה</legend>
        <div className="flex gap-2">
          <input
            value={adminName}
            onChange={(e) => setAdminName(e.target.value)}
            placeholder="שם (בלי רווחים)"
            aria-label="שם המנהל/ת"
            className={cn(field, "w-2/5 shrink-0")}
          />
          <input
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            type="email"
            dir="ltr"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="name@gmail.com"
            aria-label="המייל של המנהל/ת"
            className={cn(field, "min-w-0 flex-1 text-start")}
          />
        </div>
        {(adminNameError || adminEmailError) && (
          <p className="text-xs text-rose-300">{adminNameError ?? adminEmailError}</p>
        )}
      </fieldset>

      <PeopleField
        label="חברים (עורכים)"
        value={editorsText}
        onChange={setEditorsText}
        parsed={editors}
      />
      <PeopleField
        label="צפייה בלבד"
        value={viewersText}
        onChange={setViewersText}
        parsed={viewers}
      />

      {listClashes.length > 0 && (
        <ul className="space-y-0.5 text-xs text-rose-300">
          {listClashes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      )}
      {serverError && (
        <p className="whitespace-pre-line rounded-xl bg-rose-500/10 p-3 text-xs text-rose-200">
          {serverError}
        </p>
      )}

      <button
        type="submit"
        disabled={!ready || busy}
        className="tap flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-40"
      >
        {busy ? "יוצרים..." : "יצירת הקבוצה"}
      </button>
    </form>
  );
}

/**
 * A textarea for a pasted list, with each line read back underneath: the name
 * and email it found, or what's wrong with that line.
 */
export function PeopleField({
  label,
  value,
  onChange,
  parsed,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  parsed: ParsedLine[];
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-white/60">{label}</span>
      {/* dir=ltr because the lines lead with emails; Hebrew names still
          render right to left inside each line. */}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        dir="ltr"
        rows={3}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder={"dana@gmail.com דנה\nron.levi@gmail.com רון"}
        className={cn(field, "min-h-20 py-2 text-start leading-relaxed")}
      />
      {parsed.length > 0 && (
        <ul className="space-y-1 text-xs">
          {parsed.map((p, i) => (
            <li key={i} className="flex items-center gap-2">
              {p.error ? (
                <>
                  <X className="size-3.5 shrink-0 text-rose-300" />
                  <span className="min-w-0">
                    <span dir="ltr" className="block truncate text-start text-white/40">
                      {p.line}
                    </span>
                    <span className="block text-rose-300">{p.error}</span>
                  </span>
                </>
              ) : (
                <>
                  <Check className="size-3.5 shrink-0 text-aqua-400" />
                  <span className="font-semibold text-white/80">{p.name}</span>
                  <span dir="ltr" className="min-w-0 truncate text-white/45">
                    {p.email}
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </label>
  );
}

/** People who already had a row keep their name; say so when it isn't the one typed. */
export function KeptNames({ kept }: { kept: Created["kept"] }) {
  if (kept.length === 0) return null;
  return (
    <ul className="space-y-1 rounded-xl bg-white/5 p-3 text-xs text-white/60">
      {kept.map((k) => (
        <li key={k.email}>
          <span dir="ltr">{k.email}</span> כבר רשום/ה באפליקציה, ולכן נשאר/ה בשם {k.name} (ולא{" "}
          {k.typed})
        </li>
      ))}
    </ul>
  );
}

/** Right after creating: the message to paste into the group's WhatsApp. */
function CreatedCard({ created, link, onDone }: { created: Created; link: string; onDone: () => void }) {
  const message = inviteMessage(created.group.name, link);
  return (
    <section className="glass space-y-3 rounded-glass p-4">
      <h2 className="font-bold">הקבוצה &quot;{created.group.name}&quot; נוצרה ✅</h2>
      <p className="text-sm text-white/60">
        שלחו להם את ההודעה הזו בוואטסאפ. מנהל/ת הקבוצה יוכל/תוכל ליצור בה טיול.
      </p>
      <KeptNames kept={created.kept} />
      <p className="rounded-xl bg-white/5 p-3 text-sm leading-relaxed whitespace-pre-line text-white/80">
        {message}
      </p>
      <div className="flex gap-2">
        <CopyButton getText={() => message} label="העתקה לוואטסאפ" />
        <button
          onClick={onDone}
          className="tap rounded-xl px-3 text-xs font-semibold text-white/50 transition active:scale-95"
        >
          קבוצה נוספת
        </button>
      </div>
    </section>
  );
}

function GroupCard({ group, link }: { group: GroupSummary; link: string }) {
  const [open, setOpen] = useState(false);
  const admins = group.members.filter((m) => m.role === "admin");

  return (
    <li className="glass rounded-glass">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="tap flex w-full items-center gap-3 p-4 text-start"
      >
        <Users className="size-5 shrink-0 text-brand-300" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{group.name}</span>
          <span className="block truncate text-xs text-white/50">
            {group.members.length} אנשים · {group.trips === 0 ? "עוד בלי טיול" : group.trips === 1 ? "טיול אחד" : `${group.trips} טיולים`}
            {admins.length > 0 && ` · מנהל/ת: ${admins.map((a) => a.name).join(", ")}`}
          </span>
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-white/35 transition", open && "rotate-180")} />
      </button>

      {open && (
        <div className="space-y-3 border-t border-white/10 p-4">
          <ul className="space-y-1.5">
            {group.members.map((m) => (
              <li key={m.userId} className="flex items-center gap-2 text-sm">
                <span className="font-semibold text-white/85">{m.name}</span>
                <span dir="ltr" className="min-w-0 flex-1 truncate text-start text-xs text-white/40">
                  {m.email}
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    m.role === "admin" ? "bg-brand-500/20 text-brand-200" : "bg-white/5 text-white/50",
                  )}
                >
                  {ROLE_LABEL[m.role]}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => inviteMessage(group.name, link)} label="הודעת הזמנה לוואטסאפ" />
            <Link
              href={`/g/${group.id}`}
              className="tap flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-semibold text-white/60 transition active:scale-95"
            >
              <UserCog className="size-3.5" />
              ניהול הקבוצה
            </Link>
          </div>
        </div>
      )}
    </li>
  );
}
