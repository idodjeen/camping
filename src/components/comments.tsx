"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AtSign, Check, Loader2, MessageCircle, Pencil, Send, Trash2, Users, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";

import { Modal } from "@/components/modal";
import { toast } from "@/components/toast";
import { UserAvatar } from "@/components/user-avatar";
import { ApiError, fetcher, send, swrConfig } from "@/lib/api";
import { formatRelative } from "@/lib/dates";
import { useInbox } from "@/lib/inbox-client";
import { EVERYONE } from "@/lib/mention-all";
import { THREAD } from "@/lib/threads";
import { useTrip } from "@/lib/trip-client";
import { cn } from "@/lib/utils";

type Person = { id: number; name: string; slug: string; avatarUrl: string | null };
type CommentView = {
  id: number;
  body: string;
  createdAt: string;
  editedAt: string | null;
  author: Person;
  mentions: string[];
};
type Thread = { comments: CommentView[]; label: string };
type Me = { user: { id: number; isAdmin: boolean; isViewer: boolean }; people: Person[] };

export type Subject = "gear" | "shopping" | "meal";

/**
 * Says in words that a row is holding a question for you.
 *
 * The outline and the tinted bubble only work if you already know what the
 * colour means. This is the part that does not need decoding — and decoding
 * was the whole problem: the nav badge said two tags existed in this list
 * without anything saying which rows they were on.
 */
export function TaggedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/25 px-2 py-0.5 text-[10px] font-semibold text-brand-100 ring-1 ring-brand-400/40">
      <AtSign className="size-3" />
      תייגו אותך
    </span>
  );
}

/**
 * The affordance on a row: a bubble carrying the count.
 *
 * When the thread holds an unread tag for you the bubble becomes a filled
 * pill with a dot, because a plain count is indistinguishable from any other
 * busy thread — which made the nav badge ("2 waiting in gear") a dead end:
 * nothing in the list said which two rows it meant.
 */
export function CommentsButton({
  subject,
  id,
  count,
  name,
  unread = 0,
}: {
  subject: Subject;
  id: number;
  count: number;
  name: string;
  /** Unread mentions of me in this thread. */
  unread?: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={unread > 0 ? `תגובות על ${name} — תייגו אותך` : `תגובות על ${name}`}
        className={cn(
          "tap relative flex items-center gap-1 rounded-xl px-2 text-xs font-semibold transition active:scale-95",
          unread > 0 ? "bg-brand-500/25 text-brand-100 ring-1 ring-brand-400/45"
          : count > 0 ? "text-brand-300"
          : "text-white/35",
        )}
      >
        <MessageCircle className="size-4" />
        {count > 0 && <span className="tabular-nums">{count}</span>}
        {unread > 0 && (
          <span className="absolute -top-0.5 -end-0.5 size-2 rounded-full bg-brand-400 ring-2 ring-night-900" />
        )}
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
  const { api } = useTrip();
  const key = open ? api(`/comments?subject=${subject}&id=${id}`) : null;
  const { data, isLoading, mutate } = useSWR<Thread>(key, fetcher, swrConfig);
  const { data: me, mutate: mutateMe } = useSWR<Me>(api("/me"), fetcher, swrConfig);
  const { mutate: globalMutate } = useSWRConfig();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const edit = useEditing(draft, setDraft, boxRef);
  // Closing the sheet leaves edit mode, so it reopens as a plain composer.
  const editingNow = edit.editing !== null;
  const cancelEdit = edit.cancel;
  useEffect(() => {
    if (!open && editingNow) cancelEdit();
  }, [open, editingNow, cancelEdit]);

  // Opening the thread reads it: the bell group, the badges and the
  // notification on the phone all clear. Again if something new lands in it
  // while it is open. Viewers have nothing to read (and would get a 403).
  const { data: inbox, readThread } = useInbox();
  const thread = THREAD.item(subject, id);
  const waiting = inbox?.unread.some((g) => g.thread === thread) ?? false;
  const viewer = me?.user.isViewer;
  const read = useRef(false);
  useEffect(() => {
    if (!open) {
      read.current = false;
      return;
    }
    if (viewer !== false || (read.current && !waiting)) return;
    read.current = true;
    void readThread(thread).catch(() => {});
  }, [open, viewer, waiting, thread, readThread]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    try {
      let notified: string[];
      if (edit.editing) {
        notified = await edit.save(body);
      } else {
        notified = (
          await send<{ notified: string[] }>(api("/comments"), "POST", { subject, id, body })
        ).notified;
        setDraft("");
      }
      await mutate();
      await mutateMe();
      await globalMutate(api("/inbox"));
      if (notified.length > 0) toast(`נשלח מייל ל${notified.join(", ")}`, "ok");
    } catch (err) {
      // Deleted on another device meanwhile: say so, leave edit mode, show what's there.
      if (err instanceof ApiError && err.status === 404 && edit.editing) {
        edit.cancel();
        void mutate();
      }
      toast(err instanceof ApiError ? err.message : edit.editing ? "לא הצלחנו לשמור" : "לא הצלחנו לשלוח");
    } finally {
      setBusy(false);
    }
  }

  async function remove(commentId: number) {
    try {
      await send(api(`/comments/${commentId}`), "DELETE");
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
            אפשר לתייג מישהו עם @ והוא יקבל מייל, או את כולם עם @כולם.
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
                    <span className="text-[10px] text-white/30">
                      {formatRelative(c.createdAt)}
                      <Edited at={c.editedAt} />
                    </span>
                    {c.author.id === myId && !viewer && (
                      <span className="ms-auto">
                        <EditButton onClick={() => edit.start(c)} />
                      </span>
                    )}
                    {(c.author.id === myId || me?.user.isAdmin) && (
                      <button
                        onClick={() => remove(c.id)}
                        aria-label="למחוק תגובה"
                        className={cn(
                          "text-white/25 active:text-rose-300",
                          !(c.author.id === myId && !viewer) && "ms-auto",
                        )}
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
        {edit.editing && <EditBar onCancel={edit.cancel} />}
        <MentionBox
          value={draft}
          onChange={setDraft}
          people={people}
          boxRef={boxRef}
          onEscape={edit.editing ? edit.cancel : undefined}
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="tap mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500/25 text-sm font-semibold text-brand-100 transition active:scale-95 disabled:opacity-30"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : edit.editing ? (
            <Check className="size-4" />
          ) : (
            <Send className="size-4" />
          )}
          {edit.editing ? "שמירה" : "לשלוח"}
        </button>
      </form>
    </Modal>
  );
}

/**
 * Editing your own message happens in the composer, not in the bubble, so the
 * list never reflows (the room follows new messages by scroll position). The
 * draft you had is put aside and comes back on cancel or after saving.
 */
export function useEditing(draft: string, setDraft: (v: string) => void, boxRef: React.RefObject<HTMLTextAreaElement | null>) {
  const { api } = useTrip();
  const [editing, setEditing] = useState<{ id: number; stash: string } | null>(null);

  function start(c: { id: number; body: string }) {
    setEditing({ id: c.id, stash: editing ? editing.stash : draft });
    setDraft(c.body);
    boxRef.current?.focus();
  }

  function cancel() {
    if (!editing) return;
    setDraft(editing.stash);
    setEditing(null);
  }

  /** Saves; returns who was newly tagged. Throws the API error for the caller's toast. */
  async function save(body: string) {
    if (!editing) return [];
    const res = await send<{ notified: string[] }>(api(`/comments/${editing.id}`), "PATCH", { body });
    setDraft(editing.stash);
    setEditing(null);
    return res.notified;
  }

  return { editing, start, cancel, save };
}

/** Above the composer while editing: what's going on, and the way out. */
export function EditBar({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="mb-2 flex items-center gap-2 rounded-xl border border-line bg-surface ps-3 text-[13px] font-semibold text-ink">
      <Pencil aria-hidden className="size-3.5 text-muted" />
      <span className="flex-1">עריכת הודעה</span>
      <button
        type="button"
        onClick={onCancel}
        aria-label="ביטול עריכה"
        className="tap grid place-items-center text-muted active:scale-95"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

/**
 * The pencil on your own bubble. Small to look at, but its hit area is
 * stretched to 44px so it fits a bubble's header without growing it.
 */
export function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="לערוך הודעה"
      className="relative grid size-6 place-items-center text-muted after:absolute after:-inset-2.5 after:content-[''] active:scale-95"
    >
      <Pencil className="size-3.5" />
    </button>
  );
}

/** Beside the time on an edited message. Inherits the time's size and colour. */
export const Edited = ({ at }: { at: string | null }) => (at ? <span> (נערך)</span> : null);

/**
 * Textarea with an @ picker.
 *
 * The picker only inserts text — the server decides who was actually mentioned
 * by re-reading the body, so deleting "@ניר" before sending really does undo
 * the mention.
 */
export function MentionBox({
  value,
  onChange,
  people,
  boxRef,
  rows = 2,
  placeholder = "לכתוב תגובה… אפשר לתייג עם @",
  onEscape,
}: {
  value: string;
  onChange: (v: string) => void;
  people: Person[];
  boxRef: React.RefObject<HTMLTextAreaElement | null>;
  rows?: number;
  placeholder?: string;
  /** Escape while no picker is open, e.g. to leave edit mode. Stops the sheet closing too. */
  onEscape?: () => void;
}) {
  // The word being typed after an @, if the caret sits inside one.
  const partial = /(?:^|\s)@([^\s@]*)$/.exec(value)?.[1];
  const matches =
    partial === undefined ? [] : people.filter((p) => p.name.startsWith(partial)).slice(0, 5);
  const offerEveryone = partial !== undefined && EVERYONE.startsWith(partial);
  // Everyone first, then people — the same order the chips are drawn in.
  const options = [...(offerEveryone ? [EVERYONE] : []), ...matches.map((p) => p.name)];
  const [cursor, setCursor] = useState(0);
  const active = Math.min(cursor, Math.max(options.length - 1, 0));

  function pick(name: string) {
    onChange(value.replace(/@[^\s@]*$/, `@${name} `));
    setCursor(0);
    boxRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Cmd+Enter (Mac) / Ctrl+Enter sends.
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
      return;
    }
    if (e.key === "Escape" && onEscape && options.length === 0) {
      // The overlay closes on Escape from a window listener; this one is first.
      e.preventDefault();
      e.stopPropagation();
      onEscape();
      return;
    }
    if (options.length === 0 || e.nativeEvent.isComposing) return;
    // The chips run right-to-left, so "next" is down or left.
    if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
      e.preventDefault();
      setCursor((active + 1) % options.length);
    } else if (e.key === "ArrowUp" || e.key === "ArrowRight") {
      e.preventDefault();
      setCursor((active - 1 + options.length) % options.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      pick(options[active]);
    }
  }

  return (
    <div className="relative">
      {(matches.length > 0 || offerEveryone) && (
        <div className="absolute bottom-full mb-1.5 flex w-full flex-wrap gap-1.5 rounded-xl border border-white/10 bg-night-800 p-2 shadow-xl">
          {offerEveryone && (
            <button
              type="button"
              onClick={() => pick(EVERYONE)}
              className={`tap flex items-center gap-1.5 rounded-lg bg-brand-500/25 px-2 text-xs font-semibold text-brand-100 active:scale-95 ${active === 0 ? "ring-2 ring-brand-300" : ""}`}
            >
              <Users className="size-4" />
              {EVERYONE}
            </button>
          )}
          {matches.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => pick(p.name)}
              className={`tap flex items-center gap-1.5 rounded-lg bg-white/5 px-2 text-xs font-semibold active:scale-95 ${active === i + (offerEveryone ? 1 : 0) ? "ring-2 ring-brand-300" : ""}`}
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
        onChange={(e) => {
          onChange(e.target.value);
          setCursor(0);
        }}
        onKeyDown={onKeyDown}
        rows={rows}
        maxLength={1000}
        placeholder={placeholder}
        className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-white/25 focus:border-brand-400/40"
      />
    </div>
  );
}

/** Renders @name in the accent colour, leaving the rest of the text alone. */
export function highlight(body: string, people: Person[]) {
  if (people.length === 0) return body;
  const names = [EVERYONE, ...people.map((p) => p.name)]
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
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
