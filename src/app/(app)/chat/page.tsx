"use client";

import { AtSign, MessageCircle, MessagesSquare } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";

import { CommentsSheet, type Subject } from "@/components/comments";
import { PageTitle, SkeletonList } from "@/components/skeletons";
import { UserAvatar } from "@/components/user-avatar";
import { fetcher, swrConfig } from "@/lib/api";
import { formatRelative } from "@/lib/dates";
import type { ChatMessage } from "@/lib/comments";
import { cn } from "@/lib/utils";

type Me = { user: { id: number }; unreadMentions?: { general: number } };
type Filter = "all" | "tagged" | Subject;

const LIST_LABEL: Record<Subject, string> = { gear: "ציוד", shopping: "קניות", meal: "ארוחות" };
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "הכל" },
  { key: "tagged", label: "תייגו אותי" },
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

/** The /api/chat feed carries item comments only; the general room lives at /room. */
type ItemMessage = ChatMessage & { subject: Subject };
const isItem = (m: ChatMessage): m is ItemMessage => m.subject !== "general";

export default function ChatPage() {
  const { data, isLoading } = useSWR<{ messages: ChatMessage[] }>("/api/chat", fetcher, swrConfig);
  const { data: me } = useSWR<Me>("/api/me", fetcher, swrConfig);
  const [filter, setFilter] = useState<Filter>("all");
  const [thread, setThread] = useState<{ subject: Subject; id: number; name: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastId = useRef<number | null>(null);

  const messages = useMemo(() => {
    const all = (data?.messages ?? []).filter(isItem);
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

  const myId = me?.user.id;
  const unreadTags = data?.messages.filter((m) => m.unread).length ?? 0;
  const roomUnread = me?.unreadMentions?.general ?? 0;

  let prevItem = "";
  let prevDay = "";

  return (
    <>
      <PageTitle
        title="תגובות"
        subtitle="כל התגובות על הפריטים, במקום אחד"
        action={
          <Link
            href="/room"
            aria-label={roomUnread > 0 ? "חדר צ׳אט — תייגו אותך" : "חדר צ׳אט"}
            className={cn(
              "tap relative flex items-center gap-1.5 rounded-2xl border px-3 text-xs font-semibold transition active:scale-95",
              roomUnread > 0
                ? "border-brand-400/30 bg-brand-500/15 text-brand-200"
                : "border-white/10 bg-white/5 text-white/60",
            )}
          >
            <MessagesSquare className="size-4" />
            חדר צ׳אט
            {roomUnread > 0 && (
              <span className="grid size-4 place-items-center rounded-full bg-brand-500 text-[9px] font-bold text-white">
                {roomUnread}
              </span>
            )}
          </Link>
        }
      />

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
            {filter === "all"
              ? "עוד אף אחד לא כתב כלום."
              : "אין הודעות בסינון הזה."}
            <br />
            תגובות נכתבות על פריט — ציוד, קניות או ארוחה — ומופיעות כאן.
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

            return (
              <div key={m.id}>
                {newDay && (
                  <p className="my-3 text-center text-[11px] font-semibold text-white/30">
                    {day.label}
                  </p>
                )}
                {(newItem || newDay) && (
                  <button
                    onClick={() => setThread({ subject: m.subject, id: m.subjectId, name: m.subjectLabel })}
                    className="mb-1.5 mt-2.5 flex max-w-full items-center gap-1 rounded-lg bg-white/8 px-2 py-1 text-[11px] font-semibold text-white/55 active:scale-95"
                  >
                    <span className="text-white/35">{LIST_LABEL[m.subject]} ·</span>
                    <span className="truncate">{m.subjectLabel}</span>
                  </button>
                )}
                <button
                  onClick={() => setThread({ subject: m.subject, id: m.subjectId, name: m.subjectLabel })}
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
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-white/80">
                      {m.body}
                    </p>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {messages.length > 0 && (
        <p className="mt-5 text-center text-[11px] text-white/25">
          לחיצה על הודעה פותחת את השרשור שלה, שם אפשר להשיב ולתייג
        </p>
      )}
      <div ref={bottomRef} className="scroll-mb-24" />

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
