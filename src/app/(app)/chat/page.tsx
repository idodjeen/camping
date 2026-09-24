"use client";

import { AtSign, Loader2, MessageCircle, Send, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";

import { CommentsSheet, MentionBox, highlight, type Subject } from "@/components/comments";
import { PageTitle, SkeletonList } from "@/components/skeletons";
import { toast } from "@/components/toast";
import { UserAvatar } from "@/components/user-avatar";
import { ApiError, NOTIFICATIONS_KEY, fetcher, send, swrConfig } from "@/lib/api";
import { formatRelative } from "@/lib/dates";
import type { ChatMessage } from "@/lib/comments";
import { cn } from "@/lib/utils";

type Person = { id: number; name: string; slug: string; avatarUrl: string | null };
type Me = { user: { id: number; isAdmin: boolean }; people: Person[] };
type Filter = "all" | "tagged" | "general" | Subject;

const LIST_LABEL: Record<Subject, string> = { gear: "ציוד", shopping: "קניות", meal: "ארוחות" };
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "הכל" },
  { key: "tagged", label: "תייגו אותי" },
  { key: "general", label: "כללי" },
  { key: "gear", label: "ציוד" },
  { key: "shopping", label: "קניות" },
  { key: "meal", label: "ארוחות" },
];

/** "היום" / "אתמול" / "23.9" — days are cut in Israel time, like everything else here. */
function dayLabel(iso: string): { key: string; label: string } {
  const fmt = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(d);
  const key = fmt(new Date(iso));
  const now = new Date();
  if (key === fmt(now)) return { key, label: "היום" };
  if (key === fmt(new Date(now.getTime() - 86_400_000))) return { key, label: "אתמול" };
  const [, m, d] = key.split("-");
  return { key, label: `${Number(d)}.${Number(m)}` };
}

export default function ChatPage() {
  const { data, isLoading, mutate } = useSWR<{ messages: ChatMessage[] }>(
    "/api/chat",
    fetcher,
    swrConfig,
  );
  const { data: me, mutate: mutateMe } = useSWR<Me>("/api/me", fetcher, swrConfig);
  const { mutate: globalMutate } = useSWRConfig();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [thread, setThread] = useState<{ subject: Subject; id: number; name: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastId = useRef<number | null>(null);

  const messages = useMemo(() => {
    const all = data?.messages ?? [];
    return all.filter((m) =>
      filter === "all" ? true : filter === "tagged" ? m.taggedMe : m.subject === filter,
    );
  }, [data, filter]);

  const newest = messages.at(-1)?.id ?? null;
  // A conversation opens at its end. After that, only follow new messages if
  // you were already reading the bottom — yanking someone away from an older
  // message they are reading, on a 15s poll, would be hostile.
  useEffect(() => {
    if (newest === null) return;
    const first = lastId.current === null;
    const nearBottom =
      window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 240;
    if (first || (newest !== lastId.current && nearBottom)) {
      bottomRef.current?.scrollIntoView({ behavior: first ? "auto" : "smooth", block: "end" });
    }
    lastId.current = newest;
  }, [newest]);

  // Switching filter is a new conversation view; start at its end again.
  useEffect(() => {
    lastId.current = null;
  }, [filter]);

  // Being on this tab is what reads the general room, the way opening a sheet
  // reads an item's thread. Item tags stay unread until their sheet is opened.
  const generalUnread = data?.messages.some((m) => m.subject === "general" && m.unread) ?? false;
  useEffect(() => {
    if (!generalUnread) return;
    void send("/api/chat/read", "POST")
      .then(() => Promise.all([mutateMe(), globalMutate(NOTIFICATIONS_KEY), mutate()]))
      .catch(() => {});
  }, [generalUnread, mutateMe, globalMutate, mutate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    try {
      const res = await send<{ notified: string[] }>("/api/chat", "POST", { body });
      setDraft("");
      // Sending is a request to be at the bottom, whatever the scroll position was.
      lastId.current = null;
      if (filter !== "all" && filter !== "general") setFilter("general");
      await mutate();
      if (res.notified.length > 0) toast(`נשלח מייל ל${res.notified.join(", ")}`, "ok");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "לא הצלחנו לשלוח");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    try {
      await send(`/api/comments/${id}`, "DELETE");
      await mutate();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "לא הצלחנו למחוק");
    }
  }

  const people = me?.people ?? [];
  const myId = me?.user.id;
  const unreadTags = data?.messages.filter((m) => m.unread).length ?? 0;

  let prevItem = "";
  let prevDay = "";

  return (
    <>
      <PageTitle title="צ׳אט" subtitle="שיחה כללית, וגם כל התגובות על הפריטים" />

      <div className="sticky top-0 z-10 -mx-5 mb-4 flex gap-2 overflow-x-auto bg-night-950/85 px-5 py-2 backdrop-blur-xl [scrollbar-width:none]">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "tap flex shrink-0 items-center gap-1 rounded-xl border px-3 text-xs font-semibold transition active:scale-95",
              filter === f.key
                ? "border-brand-400/40 bg-brand-500/20 text-brand-200"
                : f.key === "tagged" && unreadTags > 0
                  ? "border-brand-400/35 bg-brand-500/15 text-brand-200"
                  : "border-white/10 bg-white/5 text-white/45",
            )}
          >
            {f.key === "tagged" && <AtSign className="size-3" />}
            {f.label}
            {f.key === "tagged" && unreadTags > 0 && (
              <span className="tabular-nums">· {unreadTags}</span>
            )}
          </button>
        ))}
      </div>

      {isLoading && !data ? (
        <SkeletonList rows={5} />
      ) : messages.length === 0 ? (
        <div className="py-16 text-center">
          <MessageCircle className="mx-auto size-8 text-white/15" />
          <p className="mt-3 text-sm leading-relaxed text-white/40">
            {filter === "all" || filter === "general"
              ? "עוד אף אחד לא כתב כלום."
              : "אין הודעות בסינון הזה."}
            <br />
            אפשר לכתוב כאן לכולם, או להגיב על פריט — והתגובה תופיע כאן.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {messages.map((m) => {
            const item = `${m.subject}:${m.subjectId}`;
            const day = dayLabel(m.createdAt);
            const newItem = item !== prevItem;
            const newDay = day.key !== prevDay;
            prevItem = item;
            prevDay = day.key;
            const mine = m.author.id === myId;
            const general = m.subject === "general";
            const open = () =>
              !general &&
              setThread({ subject: m.subject as Subject, id: m.subjectId, name: m.subjectLabel });

            return (
              <div key={m.id}>
                {newDay && (
                  <p className="my-3 text-center text-[11px] font-semibold text-white/30">
                    {day.label}
                  </p>
                )}
                {!general && (newItem || newDay) && (
                  <button
                    onClick={open}
                    className="mb-1.5 mt-2.5 flex max-w-full items-center gap-1 rounded-lg bg-white/8 px-2 py-1 text-[11px] font-semibold text-white/55 active:scale-95"
                  >
                    <span className="text-white/35">{LIST_LABEL[m.subject as Subject]} ·</span>
                    <span className="truncate">{m.subjectLabel}</span>
                  </button>
                )}
                <div
                  role={general ? undefined : "button"}
                  onClick={open}
                  className={cn("flex w-full gap-2.5 text-start", mine && "flex-row-reverse")}
                >
                  {!mine && (
                    <UserAvatar
                      name={m.author.name}
                      slug={m.author.slug}
                      avatarUrl={m.author.avatarUrl}
                      size={30}
                    />
                  )}
                  <div
                    className={cn(
                      "min-w-0 max-w-[82%] rounded-2xl px-3 py-2",
                      mine ? "rounded-te-sm bg-brand-500/20" : "rounded-ts-sm bg-white/5",
                      m.unread && "ring-1 ring-brand-400/50",
                    )}
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-bold">{mine ? "אני" : m.author.name}</span>
                      <span className="text-[10px] text-white/30">{formatRelative(m.createdAt)}</span>
                      {m.taggedMe && !mine && (
                        <span className="text-[10px] font-semibold text-brand-300">תייגו אותך</span>
                      )}
                      {general && (mine || me?.user.isAdmin) && (
                        <button
                          onClick={() => remove(m.id)}
                          aria-label="למחוק הודעה"
                          className="ms-auto text-white/25 active:text-rose-300"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-white/80">
                      {general ? highlight(m.body, people) : m.body}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {messages.length > 0 && (
        <p className="mt-5 text-center text-[11px] text-white/25">
          לחיצה על הודעה על פריט פותחת את השרשור שלה, שם אפשר להשיב ולתייג
        </p>
      )}
      <div ref={bottomRef} className="scroll-mb-40" />

      {/* Rides just above the bottom nav (its height + the home indicator). */}
      <form
        onSubmit={submit}
        className="sticky bottom-[calc(env(safe-area-inset-bottom,0px)+4.25rem)] z-20 -mx-5 mt-4 border-t border-white/10 bg-night-950/90 px-5 py-2.5 backdrop-blur-xl"
      >
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <MentionBox
              value={draft}
              onChange={setDraft}
              people={people}
              boxRef={boxRef}
              rows={1}
              placeholder="לכתוב לכולם… אפשר לתייג עם @"
            />
          </div>
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            aria-label="לשלוח"
            className="tap grid shrink-0 place-items-center rounded-xl bg-brand-500/25 px-3 text-brand-100 transition active:scale-95 disabled:opacity-30"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </div>
      </form>

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
