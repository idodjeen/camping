"use client";

import { ArrowRight, Loader2, MessagesSquare, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";

import { MentionBox, highlight } from "@/components/comments";
import { toast } from "@/components/toast";
import { UserAvatar } from "@/components/user-avatar";
import { ApiError, NOTIFICATIONS_KEY, fetcher, send, swrConfig } from "@/lib/api";
import { formatRelative } from "@/lib/dates";
import type { ChatMessage } from "@/lib/comments";
import { cn } from "@/lib/utils";

type Person = { id: number; name: string; slug: string; avatarUrl: string | null };
type Me = { user: { id: number; isAdmin: boolean }; people: Person[] };

const ROOM_KEY = "/api/chat?room=general";

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

/** The crew's group chat: not about any item, just talking. */
export default function RoomPage() {
  const { data, isLoading, mutate } = useSWR<{ messages: ChatMessage[] }>(
    ROOM_KEY,
    fetcher,
    swrConfig,
  );
  const { data: me, mutate: mutateMe } = useSWR<Me>("/api/me", fetcher, swrConfig);
  const { mutate: globalMutate } = useSWRConfig();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastId = useRef<number | null>(null);

  const messages = data?.messages ?? [];
  const people = me?.people ?? [];
  const myId = me?.user.id;

  // Being in the room is what reads it, the way opening a sheet reads a thread.
  const unread = messages.some((m) => m.unread);
  useEffect(() => {
    if (!unread) return;
    void send("/api/chat/read", "POST")
      .then(() => Promise.all([mutateMe(), globalMutate(NOTIFICATIONS_KEY)]))
      // Keep the ring on the bubbles for this visit; the next poll drops it.
      .catch(() => {});
  }, [unread, mutateMe, globalMutate]);

  // Open at the end. After that follow new messages only if you were already
  // reading the bottom — a 15s poll must not yank you away from older ones.
  const newest = messages.at(-1)?.id ?? null;
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    try {
      const res = await send<{ notified: string[] }>("/api/chat", "POST", { body });
      setDraft("");
      lastId.current = null; // your own message always scrolls into view
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

  let prevDay = "";
  let prevAuthor = -1;

  return (
    <>
      <header className="sticky top-0 z-10 -mx-5 mb-3 flex items-center gap-3 border-b border-white/10 bg-night-950/85 px-5 py-2.5 backdrop-blur-xl">
        <Link
          href="/chat"
          aria-label="חזרה לצ׳אט"
          className="tap grid place-items-center text-white/55 active:scale-95"
        >
          <ArrowRight className="size-5" />
        </Link>
        <div className="grid size-9 place-items-center rounded-full bg-brand-500/20 text-brand-200">
          <MessagesSquare className="size-[18px]" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-bold leading-tight">חדר צ׳אט</h1>
          <p className="truncate text-[11px] text-white/40">
            {people.length > 0 ? people.map((p) => p.name).join(", ") : "כל החבר׳ה"}
          </p>
        </div>
      </header>

      {isLoading && !data ? (
        <p className="py-16 text-center text-sm text-white/40">טוען…</p>
      ) : messages.length === 0 ? (
        <div className="py-16 text-center">
          <MessagesSquare className="mx-auto size-8 text-white/15" />
          <p className="mt-3 text-sm leading-relaxed text-white/40">
            עוד אף אחד לא כתב כאן.
            <br />
            הודעה ראשונה? אפשר לתייג עם @ או את כולם עם @כולם.
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {messages.map((m) => {
            const day = dayLabel(m.createdAt);
            const newDay = day.key !== prevDay;
            // Consecutive messages from one person collapse under a single name.
            const head = newDay || m.author.id !== prevAuthor;
            prevDay = day.key;
            prevAuthor = m.author.id;
            const mine = m.author.id === myId;

            return (
              <div key={m.id}>
                {newDay && (
                  <p className="my-3 text-center text-[11px] font-semibold text-white/30">
                    {day.label}
                  </p>
                )}
                <div className={cn("flex items-end gap-2", mine && "flex-row-reverse", head && "mt-2")}>
                  {!mine &&
                    (head ? (
                      <UserAvatar
                        name={m.author.name}
                        slug={m.author.slug}
                        avatarUrl={m.author.avatarUrl}
                        size={30}
                      />
                    ) : (
                      <span className="size-[30px] shrink-0" />
                    ))}
                  <div
                    className={cn(
                      "min-w-0 max-w-[80%] rounded-2xl px-3 py-1.5",
                      mine ? "rounded-te-sm bg-brand-500/20" : "rounded-ts-sm bg-white/6",
                      m.unread && "ring-1 ring-brand-400/50",
                    )}
                  >
                    {head && !mine && (
                      <p className="text-xs font-bold text-brand-200">{m.author.name}</p>
                    )}
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-white/85">
                      {highlight(m.body, people)}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2 text-[10px] text-white/30">
                      <span>{formatRelative(m.createdAt)}</span>
                      {(mine || me?.user.isAdmin) && (
                        <button
                          onClick={() => remove(m.id)}
                          aria-label="למחוק הודעה"
                          className="active:text-rose-300"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
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
              placeholder="הודעה לכולם… אפשר לתייג עם @"
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
    </>
  );
}
