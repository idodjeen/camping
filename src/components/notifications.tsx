"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AtSign, Bell, CheckCheck, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";

import { CommentsSheet, type Subject } from "@/components/comments";
import { Modal } from "@/components/modal";
import { toast } from "@/components/toast";
import { UserAvatar } from "@/components/user-avatar";
import { ApiError, NOTIFICATIONS_KEY, fetcher, send, swrConfig } from "@/lib/api";
import { formatRelative } from "@/lib/dates";
import { cn } from "@/lib/utils";

type Mention = {
  id: number;
  subject: Subject;
  subjectId: number;
  subjectLabel: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  author: { id: number; name: string; slug: string; avatarUrl: string | null };
};
type Feed = { mentions: Mention[] };

/** Which list the item lives on, for the chip on each row. */
const LIST_LABEL: Record<Subject, string> = {
  gear: "ציוד",
  shopping: "קניות",
  meal: "ארוחות",
};

/**
 * The one subscription behind the bell, the pane and the banner.
 *
 * All three call this, and SWR collapses them into a single request per poll
 * because the key is the same string — the same reason the bottom nav can read
 * /api/me for free while the dashboard is also polling it.
 */
function useMentions() {
  return useSWR<Feed>(NOTIFICATIONS_KEY, fetcher, swrConfig);
}

/** What CommentsSheet needs to open a thread from a mention row. */
type OpenThread = { subject: Subject; id: number; name: string };
const threadOf = (m: Mention): OpenThread => ({
  subject: m.subject,
  id: m.subjectId,
  name: m.subjectLabel,
});

/* --------------------------------------------------------------- the bell */

/** Bell + unread count, opening the pane. Lives in the page headers. */
export function NotificationsBell() {
  const { data } = useMentions();
  const [open, setOpen] = useState(false);
  const unread = data?.mentions.filter((m) => !m.readAt).length ?? 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={
          unread === 0 ? "תיוגים"
          : unread === 1 ? "תיוגים — אחד חדש"
          : `תיוגים — ${unread} חדשים`
        }
        className={cn(
          "tap relative grid place-items-center rounded-2xl border transition active:scale-95",
          unread > 0
            ? "border-brand-400/30 bg-brand-500/15 text-brand-200"
            : "border-white/10 bg-white/5 text-white/55",
        )}
      >
        <Bell className="size-[18px]" />
        {unread > 0 && (
          <span className="absolute end-1 top-1 grid size-[17px] place-items-center rounded-full bg-brand-500 text-[9px] font-bold tabular-nums text-white ring-2 ring-night-950">
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
  const { data, isLoading, mutate } = useMentions();
  const { mutate: globalMutate } = useSWRConfig();
  const [thread, setThread] = useState<OpenThread | null>(null);
  const [clearing, setClearing] = useState(false);

  const mentions = data?.mentions ?? [];
  const unread = mentions.filter((m) => !m.readAt).length;

  async function markAll() {
    setClearing(true);
    const now = new Date().toISOString();
    try {
      await mutate(
        async () => {
          await send(NOTIFICATIONS_KEY, "POST");
          return fetcher<Feed>(NOTIFICATIONS_KEY);
        },
        {
          // Every row loses its unread styling on tap rather than after Neon
          // answers — the same optimistic pattern the gear claims use.
          optimisticData: { mentions: mentions.map((m) => ({ ...m, readAt: m.readAt ?? now })) },
          rollbackOnError: true,
          revalidate: false,
        },
      );
      // The nav badges read their counts from /api/me, not from this feed.
      await globalMutate("/api/me");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "לא הצלחנו לעדכן");
    } finally {
      setClearing(false);
    }
  }

  // Opening the thread replaces the pane rather than stacking a second sheet
  // on top of it: two portalled modals would fight over the backdrop tap.
  function openThread(m: Mention) {
    onClose();
    setThread(threadOf(m));
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title="תיוגים">
        {unread > 0 && (
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
        ) : mentions.length === 0 ? (
          <div className="py-8 text-center">
            <AtSign className="mx-auto size-7 text-white/15" />
            <p className="mt-2 text-sm leading-relaxed text-white/40">
              עוד לא תייגו אותך.
              <br />
              כשמישהו יכתוב @השם שלך בתגובה — זה יופיע כאן.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {mentions.map((m) => (
              <button
                key={m.id}
                onClick={() => openThread(m)}
                className={cn(
                  "flex w-full gap-2.5 rounded-2xl p-2.5 text-start transition active:scale-[0.98]",
                  m.readAt ? "bg-white/[0.03]" : "bg-brand-500/12 ring-1 ring-brand-400/20",
                )}
              >
                <UserAvatar
                  name={m.author.name}
                  slug={m.author.slug}
                  avatarUrl={m.author.avatarUrl}
                  size={32}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="truncate text-xs font-bold">{m.author.name}</span>
                    <span className="shrink-0 rounded-md bg-white/8 px-1.5 py-0.5 text-[10px] text-white/50">
                      {LIST_LABEL[m.subject]} · {m.subjectLabel}
                    </span>
                    <span className="ms-auto shrink-0 text-[10px] text-white/30">
                      {formatRelative(m.createdAt)}
                    </span>
                  </div>
                  <p
                    className={cn(
                      "mt-1 line-clamp-2 break-words text-sm leading-relaxed",
                      m.readAt ? "text-white/50" : "text-white/80",
                    )}
                  >
                    {m.body}
                  </p>
                </div>
                {!m.readAt && (
                  <span
                    aria-label="לא נקרא"
                    className="mt-1.5 size-2 shrink-0 self-start rounded-full bg-brand-400"
                  />
                )}
              </button>
            ))}
          </div>
        )}
      </Modal>

      {thread && (
        <CommentsSheet
          open
          onClose={() => setThread(null)}
          subject={thread.subject}
          id={thread.id}
          name={thread.name}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------- the banner */

/**
 * The highest mention id we have already popped a banner for.
 *
 * This deliberately does *not* reuse `read_at`. "Did I show you a banner" and
 * "did you open the thread" are different questions: swiping a banner away
 * must not mark the message read, and a page refresh must not re-announce
 * something you already saw slide past. So the banner keeps its own
 * high-water mark on the device, while the badges keep using the server's
 * read_at.
 */
const ANNOUNCED_KEY = "camping:announced-mention";

function loadMark(): number {
  try {
    return Number(localStorage.getItem(ANNOUNCED_KEY)) || 0;
  } catch {
    // Private mode / blocked storage. The ref below still stops a loop within
    // the session; the cost is one repeat banner after a refresh.
    return 0;
  }
}

function saveMark(id: number) {
  try {
    localStorage.setItem(ANNOUNCED_KEY, String(id));
  } catch {
    /* nothing to do — see loadMark */
  }
}

/**
 * Slides a banner down when someone tags you while the app is open.
 *
 * Mounted once in the app layout, so it survives navigation between tabs and
 * fires wherever you happen to be. The 15s poll is what makes it arrive
 * without a page change.
 */
export function MentionBanner() {
  const { data } = useMentions();
  const [shown, setShown] = useState<{ mention: Mention; extra: number } | null>(null);
  const [thread, setThread] = useState<OpenThread | null>(null);
  const mark = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!data) return;
    if (mark.current === null) mark.current = loadMark();

    const fresh = data.mentions.filter((m) => !m.readAt && m.id > mark.current!);
    if (fresh.length === 0) return;

    // The feed is newest-first, so the head is the one worth showing; the rest
    // only contribute a count, and the pane has the detail.
    mark.current = fresh[0].id;
    saveMark(fresh[0].id);
    setShown({ mention: fresh[0], extra: fresh.length - 1 });

    // Advancing the mark above makes this effect idempotent: every later poll
    // returns a new `data` object but no fresh rows, so nothing re-fires.
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setShown(null), 9000);
  }, [data]);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  function open() {
    if (!shown) return;
    setThread(threadOf(shown.mention));
    setShown(null);
  }

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex justify-center px-4">
        <AnimatePresence>
          {shown && (
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
                <UserAvatar
                  name={shown.mention.author.name}
                  slug={shown.mention.author.slug}
                  avatarUrl={shown.mention.author.avatarUrl}
                  size={34}
                />
                {/* The card is the tap target; the ✕ sits outside it so
                    dismissing never also opens the thread. */}
                <button onClick={open} className="min-w-0 flex-1 text-start">
                  <p className="text-xs font-bold text-brand-200">
                    {shown.mention.author.name} תייג/ה אותך
                    <span className="font-normal text-white/45">
                      {" · "}
                      {LIST_LABEL[shown.mention.subject]} · {shown.mention.subjectLabel}
                    </span>
                  </p>
                  <p className="mt-0.5 line-clamp-2 break-words text-sm leading-relaxed text-white/80">
                    {shown.mention.body}
                  </p>
                  {shown.extra > 0 && (
                    <p className="mt-1 text-[11px] font-semibold text-white/40">
                      {shown.extra === 1 ? "ועוד תיוג אחד" : `ועוד ${shown.extra} תיוגים`}
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

      {thread && (
        <CommentsSheet
          open
          onClose={() => setThread(null)}
          subject={thread.subject}
          id={thread.id}
          name={thread.name}
        />
      )}
    </>
  );
}
