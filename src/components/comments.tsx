"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Loader2, MessageCircle, Send, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";

import { Modal } from "@/components/modal";
import { toast } from "@/components/toast";
import { UserAvatar } from "@/components/user-avatar";
import { ApiError, NOTIFICATIONS_KEY, fetcher, send, swrConfig } from "@/lib/api";
import { formatRelative } from "@/lib/dates";
import { cn } from "@/lib/utils";

type Person = { id: number; name: string; slug: string; avatarUrl: string | null };
type CommentView = {
  id: number;
  body: string;
  createdAt: string;
  author: Person;
  mentions: string[];
};
type Thread = { comments: CommentView[]; label: string };
type Me = { user: { id: number; isAdmin: boolean }; people: Person[] };

export type Subject = "gear" | "shopping" | "meal";

/** The affordance on a row: a bubble carrying the count. */
export function CommentsButton({
  subject,
  id,
  count,
  name,
}: {
  subject: Subject;
  id: number;
  count: number;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={`תגובות על ${name}`}
        className={cn(
          "tap flex items-center gap-1 rounded-xl px-2 text-xs font-semibold transition active:scale-95",
          count > 0 ? "text-brand-300" : "text-white/35",
        )}
      >
        <MessageCircle className="size-4" />
        {count > 0 && <span className="tabular-nums">{count}</span>}
      </button>
      <CommentsSheet open={open} onClose={() => setOpen(false)} subject={subject} id={id} name={name} />
    </>
  );
}

/**
 * The thread itself, split out from the row button so a notification can open
 * it straight from the pane — there the subject and id come from a mention row
 * rather than from the list you happen to be looking at.
 */
export function CommentsSheet({
  open,
  onClose,
  subject,
  id,
  name,
}: {
  open: boolean;
  onClose: () => void;
  subject: Subject;
  id: number;
  name: string;
}) {
  const key = open ? `/api/comments?subject=${subject}&id=${id}` : null;
  const { data, isLoading, mutate } = useSWR<Thread>(key, fetcher, swrConfig);
  const { data: me, mutate: mutateMe } = useSWR<Me>("/api/me", fetcher, swrConfig);
  const { mutate: globalMutate } = useSWRConfig();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLTextAreaElement>(null);

  // Opening the thread is what clears your badge for it — the nav counts come
  // from /api/me and the pane's read/unread styling from the feed, so both are
  // revalidated once the server has stamped read_at.
  useEffect(() => {
    if (!open) return;
    void send("/api/comments/read", "POST", { subject, id })
      .then(() => Promise.all([mutateMe(), globalMutate(NOTIFICATIONS_KEY)]))
      .catch(() => {});
  }, [open, subject, id, mutateMe, globalMutate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    try {
      const res = await send<{ notified: string[] }>("/api/comments", "POST", {
        subject,
        id,
        body,
      });
      setDraft("");
      await mutate();
      await mutateMe();
      await globalMutate(NOTIFICATIONS_KEY);
      if (res.notified.length > 0) toast(`נשלח מייל ל${res.notified.join(", ")}`, "ok");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "לא הצלחנו לשלוח");
    } finally {
      setBusy(false);
    }
  }

  async function remove(commentId: number) {
    try {
      await send(`/api/comments/${commentId}`, "DELETE");
      await mutate();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "לא הצלחנו למחוק");
    }
  }

  const people = me?.people ?? [];
  const myId = me?.user.id;

  return (
    <Modal open={open} onClose={onClose} title={name}>
      <div className="space-y-3">
        {isLoading && !data ? (
          <p className="py-6 text-center text-sm text-white/40">טוען…</p>
        ) : data?.comments.length === 0 ? (
          <p className="py-6 text-center text-sm leading-relaxed text-white/40">
            אין עדיין תגובות.
            <br />
            אפשר לתייג מישהו עם @ והוא יקבל מייל.
          </p>
        ) : (
          <AnimatePresence initial={false}>
            {data?.comments.map((c) => (
              <motion.div
                key={c.id}
                layout
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 16 }}
                className="flex gap-2.5"
              >
                <UserAvatar
                  name={c.author.name}
                  slug={c.author.slug}
                  avatarUrl={c.author.avatarUrl}
                  size={30}
                />
                <div className="min-w-0 flex-1 rounded-2xl rounded-ts-sm bg-white/5 px-3 py-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-bold">{c.author.name}</span>
                    <span className="text-[10px] text-white/30">{formatRelative(c.createdAt)}</span>
                    {(c.author.id === myId || me?.user.isAdmin) && (
                      <button
                        onClick={() => remove(c.id)}
                        aria-label="למחוק תגובה"
                        className="ms-auto text-white/25 active:text-rose-300"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-white/75">
                    {highlight(c.body, people)}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      <form onSubmit={submit} className="mt-4 border-t border-white/10 pt-3">
        <MentionBox value={draft} onChange={setDraft} people={people} boxRef={boxRef} />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="tap mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500/25 text-sm font-semibold text-brand-100 transition active:scale-95 disabled:opacity-30"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          לשלוח
        </button>
      </form>
    </Modal>
  );
}

/**
 * Textarea with an @ picker.
 *
 * The picker only inserts text — the server decides who was actually mentioned
 * by re-reading the body, so deleting "@ניר" before sending really does undo
 * the mention.
 */
function MentionBox({
  value,
  onChange,
  people,
  boxRef,
}: {
  value: string;
  onChange: (v: string) => void;
  people: Person[];
  boxRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  // The word being typed after an @, if the caret sits inside one.
  const partial = /(?:^|\s)@([^\s@]*)$/.exec(value)?.[1];
  const matches =
    partial === undefined ? [] : people.filter((p) => p.name.startsWith(partial)).slice(0, 5);

  function pick(p: Person) {
    onChange(value.replace(/@[^\s@]*$/, `@${p.name} `));
    boxRef.current?.focus();
  }

  return (
    <div className="relative">
      {matches.length > 0 && (
        <div className="absolute bottom-full mb-1.5 flex w-full flex-wrap gap-1.5 rounded-xl border border-white/10 bg-night-800 p-2 shadow-xl">
          {matches.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => pick(p)}
              className="tap flex items-center gap-1.5 rounded-lg bg-white/5 px-2 text-xs font-semibold active:scale-95"
            >
              <UserAvatar name={p.name} slug={p.slug} avatarUrl={p.avatarUrl} size={20} />
              {p.name}
            </button>
          ))}
        </div>
      )}
      <textarea
        ref={boxRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        maxLength={1000}
        placeholder="לכתוב תגובה… אפשר לתייג עם @"
        className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-white/25 focus:border-brand-400/40"
      />
    </div>
  );
}

/** Renders @name in the accent colour, leaving the rest of the text alone. */
function highlight(body: string, people: Person[]) {
  if (people.length === 0) return body;
  const names = people
    .map((p) => p.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .sort((a, b) => b.length - a.length)
    .join("|");
  return body.split(new RegExp(`(@(?:${names}))`, "u")).map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className="font-semibold text-brand-300">
        {part}
      </span>
    ) : (
      part
    ),
  );
}
