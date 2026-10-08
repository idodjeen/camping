"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Bell, CheckCheck, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { CommentsSheet, TaggedBadge } from "@/components/comments";
import { Modal } from "@/components/modal";
import { toast } from "@/components/toast";
import { UserAvatar } from "@/components/user-avatar";
import { ApiError } from "@/lib/api";
import { formatRelative } from "@/lib/dates";
import { useInbox } from "@/lib/inbox-client";
import type { InboxGroup, InboxRow, Person } from "@/lib/notifications";
import { setAppBadge } from "@/lib/push-client";
import type { Subject, Target } from "@/lib/threads";
import { useTrip } from "@/lib/trip-client";

/** Which list the item lives on, for the chip on each row. */
const LIST_LABEL: Record<Subject, string> = { gear: "ציוד", shopping: "קניות", meal: "ארוחות" };

/** "ציוד · שק שינה", or just "צ׳אט כללי": only items have a list to name. */
const where = (r: { label: string; target: Target }) =>
  r.target.sheet ? `${LIST_LABEL[r.target.sheet.subject]} · ${r.label}` : r.label;

/** What happened, as the bold line of a single row. */
function headline(r: InboxRow) {
  switch (r.kind) {
    case "mention":
      return `${r.actor.name} תייג/ה אותך`;
    case "message":
      return `${r.actor.name} כתב/ה`;
    case "covered":
      return "הפריט מכוסה";
    default:
      return r.label;
  }
}

function text(r: InboxRow) {
  return r.kind === "covered" ? `${r.actor.name} לקח/ה את היחידה האחרונה` : r.text;
}

/** "ניר", "ניר ואור", "ניר, אור ועוד 1". */
function names(people: Person[]) {
  const [a, b] = people;
  if (people.length <= 1) return a?.name ?? "";
  if (people.length === 2) return `${a.name} ו${b.name}`;
  return `${a.name}, ${b.name} ועוד ${people.length - 2}`;
}

/** A group's bold line: one event reads as itself, several name who wrote. */
const groupHeadline = (g: InboxGroup) => (g.count > 1 ? names(g.actors) : headline(g.latest));

/** A group's preview: the latest event, saying whose it is when there are several. */
const groupText = (g: InboxGroup) =>
  g.count > 1 && g.latest.kind !== "covered" ? `${g.latest.actor.name}: ${text(g.latest)}` : text(g.latest);

/** Up to three overlapping faces, newest first. */
function Faces({ people, size = 32 }: { people: Person[]; size?: number }) {
  return (
    <span className="flex shrink-0 self-start">
      {people.slice(0, 3).map((p) => (
        <span key={p.id} className="-ms-3 rounded-full ring-2 ring-night-900 first:ms-0">
          <UserAvatar name={p.name} slug={p.slug} avatarUrl={p.avatarUrl} size={size} />
        </span>
      ))}
    </span>
  );
}

/**
 * Opens what a bell row is about: its thread sheet, or the screen it names.
 * Shared by the pane and the banner, which each render the sheet themselves.
 */
function useOpener() {
  const { page } = useTrip();
  const router = useRouter();
  const [thread, setThread] = useState<{ subject: Subject; id: number; name: string } | null>(null);

  const open = (target: Target, label: string) => {
    if (target.sheet) setThread({ ...target.sheet, name: label });
    else router.push(page(target.page));
  };

  const sheet = thread && (
    <CommentsSheet
      open
      onClose={() => setThread(null)}
      subject={thread.subject}
      id={thread.id}
      name={thread.name}
    />
  );
  return { open, sheet };
}

/* --------------------------------------------------------------- the bell */

/** Bell + unread threads, opening the pane. Lives in the app header. */
export function NotificationsBell() {
  const { data } = useInbox();
  const [open, setOpen] = useState(false);
  const unread = data?.counts.threads ?? 0;

  // The app icon counts unread threads on every trip. Set on every poll, so a
  // thread read on another device clears here on the next fetch.
  const icon = data ? data.counts.threads + data.counts.otherTrips : null;
  useEffect(() => {
    if (icon !== null) setAppBadge(icon);
  }, [icon]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={
          unread === 0 ? "התראות"
          : unread === 1 ? "התראות — אחת חדשה"
          : `התראות — ${unread} חדשות`
        }
        className="relative grid size-[46px] place-items-center rounded-full border-[1.5px] border-line bg-surface text-ink transition active:scale-95"
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute -end-1 -top-1 grid h-[19px] min-w-[19px] place-items-center rounded-full border-2 border-canvas bg-cta px-1 text-[11px] font-bold tabular-nums text-on-cta">
            {unread}
          </span>
        )}
      </button>
      <NotificationsPane open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/* --------------------------------------------------------------- the pane */

function NotificationsPane({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, isLoading, readThread, readAll } = useInbox();
  const opener = useOpener();
  const [clearing, setClearing] = useState(false);

  const groups = data?.unread ?? [];
  const recent = data?.recent ?? [];

  async function markAll() {
    setClearing(true);
    try {
      // Up to what is on screen: anything that lands meanwhile stays unread.
      await readAll(Math.max(0, ...groups.map((g) => g.newestId)));
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "לא הצלחנו לעדכן");
    } finally {
      setClearing(false);
    }
  }

  // Opening the thread replaces the pane rather than stacking a second sheet
  // on top of it: two portalled modals would fight over the backdrop tap.
  function openGroup(g: InboxGroup) {
    onClose();
    void readThread(g.thread, g.newestId).catch(() => {});
    opener.open(g.target, g.label);
  }

  function openRow(r: InboxRow) {
    onClose();
    opener.open(r.target, r.label);
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title="התראות">
        {groups.length > 0 && (
          <button
            onClick={markAll}
            disabled={clearing}
            className="tap mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white/5 text-xs font-semibold text-white/60 transition active:scale-95 disabled:opacity-40"
          >
            {clearing ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCheck className="size-3.5" />}
            לסמן הכל כנקרא
          </button>
        )}

        {isLoading && !data ? (
          <p className="py-6 text-center text-sm text-white/40">טוען…</p>
        ) : groups.length === 0 && recent.length === 0 ? (
          <div className="py-8 text-center">
            <Bell className="mx-auto size-7 text-white/15" />
            <p className="mt-2 text-sm leading-relaxed text-white/40">
              אין התראות עדיין.
              <br />
              תיוגים, הודעות ופריטים שכוסו יופיעו כאן — אפשר לבחור מה בחשבון.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {groups.map((g) => (
              <button
                key={g.thread}
                onClick={() => openGroup(g)}
                className="flex w-full gap-2.5 rounded-2xl bg-brand-500/12 p-2.5 text-start ring-1 ring-brand-400/20 transition active:scale-[0.98]"
              >
                <Faces people={g.actors} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="truncate text-xs font-bold">{groupHeadline(g)}</span>
                    <span className="shrink-0 rounded-md bg-white/8 px-1.5 py-0.5 text-[10px] text-white/50">
                      {where(g)}
                    </span>
                    <span className="ms-auto shrink-0 text-[10px] text-white/30">
                      {formatRelative(g.latest.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 break-words text-sm leading-relaxed text-white/80">
                    {groupText(g)}
                  </p>
                  {(g.count > 1 || g.tags > 0) && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {g.count > 1 && (
                        <span className="text-[11px] font-semibold tabular-nums text-brand-200">
                          {g.count} חדשות
                        </span>
                      )}
                      {g.tags > 0 && <TaggedBadge />}
                    </div>
                  )}
                </div>
                <span
                  aria-label="לא נקרא"
                  className="mt-1.5 size-2 shrink-0 self-start rounded-full bg-brand-400"
                />
              </button>
            ))}

            {recent.length > 0 && groups.length > 0 && (
              <p className="px-1 pt-2 text-[11px] font-semibold text-white/35">נקראו</p>
            )}

            {recent.map((r) => (
              <button
                key={r.id}
                onClick={() => openRow(r)}
                className="flex w-full gap-2.5 rounded-2xl bg-white/[0.03] p-2.5 text-start transition active:scale-[0.98]"
              >
                <Faces people={[r.actor]} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="truncate text-xs font-bold">{headline(r)}</span>
                    <span className="shrink-0 rounded-md bg-white/8 px-1.5 py-0.5 text-[10px] text-white/50">
                      {where(r)}
                    </span>
                    <span className="ms-auto shrink-0 text-[10px] text-white/30">
                      {formatRelative(r.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 break-words text-sm leading-relaxed text-white/50">
                    {text(r)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </Modal>

      {opener.sheet}
    </>
  );
}

/* ------------------------------------------------------------- the banner */

/**
 * The newest row id we have already popped a banner for, per trip.
 *
 * This deliberately does *not* reuse `read_at`. "Did I show you a banner" and
 * "did you open the thread" are different questions: swiping a banner away
 * must not mark the thread read, and a page refresh must not re-announce
 * something you already saw slide past. So the banner keeps its own
 * high-water mark on the device, while the badges keep using the server's
 * read_at. Since every kind lives in one table, one mark covers them all.
 */
const markKey = (tripId: number) => `camping:announced-inbox:${tripId}`;

/** null = this device has never stored one. */
function loadMark(key: string): number | null {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : Number(raw) || 0;
  } catch {
    // Private mode / blocked storage. The ref below still stops a loop within
    // the session; the cost is one repeat banner after a refresh.
    return null;
  }
}

function saveMark(key: string, id: number) {
  try {
    localStorage.setItem(key, String(id));
  } catch {
    /* nothing to do — see loadMark */
  }
}

/**
 * Slides a banner down when something new reaches your bell while the app is
 * open, showing the thread of the newest one.
 *
 * Mounted once in the trip layout, so it survives navigation between tabs and
 * fires wherever you happen to be. The 15s poll is what makes it arrive
 * without a page change.
 */
export function MentionBanner() {
  const { id } = useTrip();
  const { data, readThread } = useInbox();
  const opener = useOpener();
  const [shown, setShown] = useState<{ group: InboxGroup; extra: number } | null>(null);
  const mark = useRef<{ trip: number; id: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!data) return;

    if (mark.current?.trip !== id) {
      const stored = loadMark(markKey(id));
      // A device that has never shown a banner on this trip starts from what
      // is already there, so the first load is not a flood of old rows.
      const start =
        stored ?? Math.max(0, ...data.unread.map((g) => g.newestId), ...data.recent.map((r) => r.id));
      mark.current = { trip: id, id: start };
      if (stored === null) saveMark(markKey(id), start);
    }
    const seen = mark.current;

    // Groups come newest first, so the head is the one worth showing; the
    // rest only contribute a count, and the pane has the detail.
    const fresh = data.unread.filter((g) => g.newestId > seen.id);
    if (fresh.length === 0) return;

    seen.id = Math.max(seen.id, ...fresh.map((g) => g.newestId));
    saveMark(markKey(id), seen.id);
    setShown({ group: fresh[0], extra: fresh.length - 1 });

    // Advancing the mark makes this effect idempotent: every later poll
    // returns a new `data` object but nothing newer, so nothing re-fires.
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setShown(null), 9000);
  }, [data, id]);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  function open() {
    if (!shown) return;
    const { group } = shown;
    void readThread(group.thread, group.newestId).catch(() => {});
    opener.open(group.target, group.label);
    setShown(null);
  }

  const g = shown?.group;

  return (
    <>
      {/* Clears the status bar: the app draws under it (black-translucent). */}
      <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+0.75rem)] z-[60] flex justify-center px-4">
        <AnimatePresence>
          {shown && g && (
            <motion.div
              role="status"
              aria-live="polite"
              initial={{ opacity: 0, y: -28, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              // Deliberately not `glass`: at 62% opacity the header text
              // underneath showed straight through the alert.
              className="glow-brand pointer-events-auto w-full max-w-md rounded-2xl border border-brand-400/25 bg-night-800/95 p-3 backdrop-blur-xl"
            >
              <div className="flex items-start gap-2.5">
                <Faces people={g.actors} size={34} />
                {/* The card is the tap target; the ✕ sits outside it so
                    dismissing never also opens the thread. */}
                <button onClick={open} className="min-w-0 flex-1 text-start">
                  <p className="text-xs font-bold text-brand-200">
                    {groupHeadline(g)}
                    <span className="font-normal text-white/45">
                      {" · "}
                      {where(g)}
                      {g.count > 1 && ` · ${g.count} חדשות`}
                    </span>
                  </p>
                  <p className="mt-0.5 line-clamp-2 break-words text-sm leading-relaxed text-white/80">
                    {groupText(g)}
                  </p>
                  {shown.extra > 0 && (
                    <p className="mt-1 text-[11px] font-semibold text-white/40">
                      {shown.extra === 1 ? "ועוד שרשור אחד" : `ועוד ${shown.extra} שרשורים`}
                    </p>
                  )}
                </button>
                <button
                  onClick={() => setShown(null)}
                  aria-label="לסגור"
                  className="shrink-0 p-1 text-white/30 active:text-white"
                >
                  <X className="size-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {opener.sheet}
    </>
  );
}
