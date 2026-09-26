"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AtSign, Loader2, MessageCircle, Send, Trash2, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";

import { ChatImage } from "@/components/chat-image";
import { AttachmentPreview, ImagePicker, type Attachment } from "@/components/image-picker";
import { Modal } from "@/components/modal";
import { toast } from "@/components/toast";
import { UserAvatar } from "@/components/user-avatar";
import { ApiError, NOTIFICATIONS_KEY, fetcher, send, swrConfig } from "@/lib/api";
import type { CommentView } from "@/lib/comments";
import { formatRelative } from "@/lib/dates";
import { EVERYONE } from "@/lib/mention-all";
import { cn } from "@/lib/utils";

type Person = { id: number; name: string; slug: string; avatarUrl: string | null };
// The server's own read model rather than a second copy of it — a field added
// there (an attached photo, most recently) then cannot be missed here.
type Thread = { comments: CommentView[]; label: string };
type Me = { user: { id: number; isAdmin: boolean }; people: Person[] };

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
  const key = open ? `/api/comments?subject=${subject}&id=${id}` : null;
  const { data, isLoading, mutate } = useSWR<Thread>(key, fetcher, swrConfig);
  const { data: me, mutate: mutateMe } = useSWR<Me>("/api/me", fetcher, swrConfig);
  const { mutate: globalMutate } = useSWRConfig();
  const [draft, setDraft] = useState("");
  const [image, setImage] = useState<Attachment | null>(null);
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
    // A photo carries a message on its own, so either one is enough to send.
    if (!body && !image) return;
    setBusy(true);
    try {
      const res = await send<{ notified: string[] }>("/api/comments", "POST", {
        subject,
        id,
        body,
        image: image && {
          publicId: image.publicId,
          width: image.width,
          height: image.height,
        },
      });
      setDraft("");
      setImage(null);
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
                  {c.body && (
                    <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-white/75">
                      {highlight(c.body, people)}
                    </p>
                  )}
                  {c.image && <ChatImage image={c.image} alt={`תמונה מ${c.author.name}`} />}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      <form onSubmit={submit} className="mt-4 border-t border-white/10 pt-3">
        {image && <AttachmentPreview attachment={image} onClear={() => setImage(null)} />}
        <MentionBox value={draft} onChange={setDraft} people={people} boxRef={boxRef} />
        <div className="mt-2 flex items-stretch gap-2">
          <ImagePicker onPicked={setImage} disabled={busy} />
          <button
            type="submit"
            disabled={busy || (!draft.trim() && !image)}
            className="tap flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-500/25 text-sm font-semibold text-brand-100 transition active:scale-95 disabled:opacity-30"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            לשלוח
          </button>
        </div>
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
export function MentionBox({
  value,
  onChange,
  people,
  boxRef,
  rows = 2,
  placeholder = "לכתוב תגובה… אפשר לתייג עם @",
}: {
  value: string;
  onChange: (v: string) => void;
  people: Person[];
  boxRef: React.RefObject<HTMLTextAreaElement | null>;
  rows?: number;
  placeholder?: string;
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
