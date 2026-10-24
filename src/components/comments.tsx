"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  AtSign,
  Check,
  Mail,
  MessageCircle,
  Package,
  Pencil,
  Send,
  ShoppingCart,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";

import { Modal } from "@/components/modal";
import { toast } from "@/components/toast";
import { confirmAction } from "@/components/ui/confirm";
import { Badge, Banner, EmptyState, ErrorState } from "@/components/ui/surfaces";
import { HIT } from "@/components/ui/tone";
import { UserAvatar } from "@/components/user-avatar";
import { ApiError, fetcher, send, swrConfig } from "@/lib/api";
import type { ItemSummary } from "@/lib/comments";
import { SLOT_LABELS, clockTime, dayLabel, formatTripDay } from "@/lib/dates";
import { inkFor } from "@/lib/gradient";
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
/** `item` is optional only for a response from a server older than the card. */
type Thread = { comments: CommentView[]; label: string; item?: ItemSummary };
type Me = { user: { id: number; isAdmin: boolean; isViewer: boolean }; people: Person[] };

export type Subject = "gear" | "shopping" | "meal";

/**
 * Says in words that a row is holding a question for you.
 *
 * The tinted bubble only works if you already know what the colour means.
 * This is the part that does not need decoding: the nav badge said two tags
 * existed in this list without anything saying which rows they were on.
 */
export function TaggedBadge() {
  return (
    <Badge tone="coral">
      <AtSign aria-hidden className="size-3.5" />
      תייגו אותך
    </Badge>
  );
}

/**
 * The affordance on a row: a bubble carrying the count.
 *
 * When the thread holds an unread tag for you the bubble becomes a filled
 * pill with a dot, because a plain count is indistinguishable from any other
 * busy thread.
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
        type="button"
        onClick={() => setOpen(true)}
        aria-label={unread > 0 ? `תגובות על ${name}, תייגו אותך` : `תגובות על ${name}`}
        className={cn(
          "inline-flex h-10 shrink-0 items-center gap-1 rounded-full px-2.5 text-[13px] font-bold transition active:scale-95",
          HIT,
          unread > 0 ? "bg-coral text-coral-ink" : count > 0 ? "text-ink" : "text-muted",
        )}
      >
        <MessageCircle aria-hidden className="size-[18px]" />
        {count > 0 && <span dir="ltr">{count}</span>}
        {unread > 0 && (
          <span aria-hidden className="absolute -top-0.5 -end-0.5 size-2.5 rounded-full bg-cta ring-2 ring-surface" />
        )}
      </button>
      <CommentsSheet open={open} onClose={() => setOpen(false)} subject={subject} id={id} name={name} />
    </>
  );
}

/**
 * The thread itself, split out from the row button so a notification or the
 * chat tab can open it too: there the subject and id come from a bell row or
 * a message rather than from the list you happen to be looking at.
 *
 * The item sits on top (what is missing, its category), then the messages by
 * day: mine on the end side in my colour, others' with their name and face.
 * The composer is the sheet's footer, so it never scrolls away.
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
  const { data, error, isLoading, mutate } = useSWR<Thread>(key, fetcher, swrConfig);
  const { data: me, mutate: mutateMe } = useSWR<Me>(api("/me"), fetcher, swrConfig);
  const { mutate: globalMutate } = useSWRConfig();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  // "נשלח מייל ל…" under the message that tagged them, for this visit only.
  const [mailed, setMailed] = useState<{ after: number; names: string[] } | null>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const edit = useEditing(draft, setDraft, boxRef);
  // Closing the sheet leaves edit mode, so it reopens as a plain composer.
  const editingNow = edit.editing !== null;
  const cancelEdit = edit.cancel;
  useEffect(() => {
    if (!open && editingNow) cancelEdit();
  }, [open, editingNow, cancelEdit]);

  const close = () => {
    setMailed(null);
    onClose();
  };

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

  // Open at the newest message, and follow new ones (yours or the poll's).
  const newest = data?.comments.at(-1)?.id;
  useEffect(() => {
    if (open && newest !== undefined) endRef.current?.scrollIntoView({ block: "end" });
  }, [open, newest]);

  const people = me?.people ?? [];
  const myId = me?.user.id;
  const myName = people.find((p) => p.id === myId)?.name;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      let notified: string[];
      let after: number | undefined;
      if (edit.editing) {
        after = edit.editing.id;
        notified = await edit.save(body);
      } else {
        const res = await send<{ notified: string[]; comments: CommentView[] }>(api("/comments"), "POST", {
          subject,
          id,
          body,
        });
        notified = res.notified;
        after = res.comments.filter((c) => c.author.id === myId).at(-1)?.id;
        setDraft("");
      }
      await mutate();
      await mutateMe();
      await globalMutate(api("/inbox"));
      if (notified.length > 0) {
        if (after !== undefined) setMailed({ after, names: notified });
        else toast(`נשלח מייל ל${notified.join(", ")}`, "ok");
      }
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

  async function remove(c: CommentView) {
    const excerpt = c.body.length > 80 ? `${c.body.slice(0, 77)}…` : c.body;
    if (!(await confirmAction({ title: "למחוק את ההודעה?", body: `"${excerpt}"` }))) return;
    try {
      await send(api(`/comments/${c.id}`), "DELETE");
      if (edit.editing?.id === c.id) edit.cancel();
      await mutate();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "לא הצלחנו למחוק");
    }
  }

  // Read-only people get a note rather than a composer whose every message
  // the API would refuse. Nothing until we know which one this is.
  const footer =
    viewer === undefined ? null : viewer ? (
      <Banner>צפייה בלבד - אפשר לקרוא, אי אפשר לכתוב</Banner>
    ) : (
      <form onSubmit={submit} className="flex flex-col">
        {edit.editing && <EditBar onCancel={edit.cancel} />}
        <MentionBox
          value={draft}
          onChange={setDraft}
          people={people}
          boxRef={boxRef}
          placeholder="תגובה… אפשר לתייג עם @"
          onEscape={edit.editing ? edit.cancel : undefined}
          trailing={<SendButton busy={busy} editing={edit.editing !== null} empty={!draft.trim()} />}
        />
      </form>
    );

  const comments = data?.comments ?? [];
  let prevDay = "";

  return (
    <Modal open={open} onClose={close} title={data?.label ?? name} eyebrow="תגובות" footer={footer}>
      <div className="flex flex-col gap-3.5">
        {data?.item ? (
          <ItemCard item={data.item} />
        ) : (
          !data && !error && <div aria-hidden className="h-[76px] animate-pulse rounded-[24px] bg-line" />
        )}

        {error && !data ? (
          <ErrorState
            icon={<AlertCircle />}
            title="לא הצלחנו לטעון את התגובות"
            body="בדקו את החיבור ונסו שוב."
            onRetry={() => void mutate()}
          />
        ) : isLoading && !data ? (
          <ThreadSkeleton />
        ) : comments.length === 0 ? (
          <EmptyState
            icon={<MessageCircle />}
            tone="peach"
            title="אין עדיין תגובות"
            body={
              viewer
                ? "כשמישהו יכתוב כאן, זה יופיע פה."
                : "אפשר לתייג מישהו עם @ והוא יקבל מייל, או את כולם עם @כולם."
            }
          />
        ) : (
          <AnimatePresence initial={false}>
            {comments.map((c) => {
              const day = dayLabel(c.createdAt);
              const newDay = day.key !== prevDay;
              prevDay = day.key;
              const mine = c.author.id === myId;
              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col gap-3.5"
                >
                  {newDay && (
                    <p className="self-center text-[13px] font-semibold text-muted">
                      <span dir={/\d/.test(day.label) ? "ltr" : undefined}>{day.label}</span>
                    </p>
                  )}
                  <Message
                    c={c}
                    mine={mine}
                    taggedMe={!mine && mentions(c.body, myName)}
                    people={people}
                    onEdit={mine && viewer === false ? () => edit.start(c) : undefined}
                    onDelete={mine || me?.user.isAdmin ? () => void remove(c) : undefined}
                  />
                  {mailed?.after === c.id && <MailedNote names={mailed.names} />}
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
        <div ref={endRef} />
      </div>
    </Modal>
  );
}

/** Does this message call me, by name or with @כולם? The same rule the server tags by. */
function mentions(body: string, name: string | undefined) {
  if (!name) return false;
  const has = (n: string) =>
    new RegExp(`@${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "u").test(body + " ");
  return has(EVERYONE) || has(name);
}

/** One message: mine on the end side in my colour, others' with their face and name. */
function Message({
  c,
  mine,
  taggedMe,
  people,
  onEdit,
  onDelete,
}: {
  c: CommentView;
  mine: boolean;
  taggedMe: boolean;
  people: Person[];
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const time = (
    <span>
      <span dir="ltr">{clockTime(c.createdAt)}</span>
      <Edited at={c.editedAt} />
    </span>
  );
  const text = (
    <p className="whitespace-pre-wrap break-words text-base leading-[1.45]">{highlight(c.body, people)}</p>
  );

  if (mine) {
    return (
      <div className="flex justify-end">
        <div className="min-w-0 max-w-[85%] rounded-[20px] rounded-ee-md bg-peach px-3.5 pt-2.5 pb-1.5 text-ink">
          {text}
          <div className="mt-0.5 flex items-center justify-end gap-5 text-[13px] text-peach-ink">
            {onEdit && <EditButton onClick={onEdit} className="text-peach-ink" />}
            {onDelete && <DeleteButton onClick={onDelete} className="text-peach-ink" />}
            {time}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5">
      <UserAvatar name={c.author.name} slug={c.author.slug} avatarUrl={c.author.avatarUrl} size={36} />
      <div
        className={cn(
          "min-w-0 flex-1 rounded-[20px] rounded-ss-md bg-surface px-3.5 py-2.5",
          taggedMe ? "border-2 border-cta" : "border-[1.5px] border-line",
        )}
      >
        <div className="flex items-center gap-2">
          <span className={cn("truncate text-[13px] font-bold", inkFor(c.author.slug))}>{c.author.name}</span>
          <span className="shrink-0 text-[13px] text-muted">{time}</span>
          <span className="flex-1" />
          {taggedMe && (
            <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-bold text-link">
              <AtSign aria-hidden className="size-3.5" />
              תייגו אותך
            </span>
          )}
          {onDelete && <DeleteButton onClick={onDelete} className="ms-2" />}
        </div>
        <div className="mt-0.5">{text}</div>
      </div>
    </div>
  );
}

/** After you tag someone: who the email went to, under that message. */
function MailedNote({ names }: { names: string[] }) {
  return (
    <p
      role="status"
      className="inline-flex min-h-[30px] items-center gap-1.5 self-center rounded-full bg-amber px-3 py-1 text-center text-[13px] font-semibold text-amber-ink"
    >
      <Mail aria-hidden className="size-3.5 shrink-0" />
      נשלח מייל ל{names.join(", ")}
    </p>
  );
}

const ICON = { gear: Package, shopping: ShoppingCart, meal: UtensilsCrossed } as const;

/** The item the thread is about: what it is, what is still missing, its category, who has it. */
function ItemCard({ item }: { item: ItemSummary }) {
  const Icon = ICON[item.kind];
  return (
    <div className="flex items-center gap-3 rounded-[24px] bg-peach p-3.5 text-ink">
      <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-tile bg-surface text-peach-ink">
        <Icon className="size-6" />
      </span>
      <div className="min-w-0 flex-1 leading-snug">
        <p className="truncate text-[17px] font-bold">{item.label}</p>
        <p className="text-sm text-peach-ink">{itemLine(item)}</p>
      </div>
      {item.people.length > 0 && <Faces people={item.people} />}
    </div>
  );
}

const Num = ({ children }: { children: React.ReactNode }) => <span dir="ltr">{children}</span>;

function itemLine(item: ItemSummary): React.ReactNode {
  const parts: React.ReactNode[] = [];
  if (item.kind === "gear") {
    const left = Math.max(item.needed - item.claimed, 0);
    parts.push(
      item.open ? (
        item.people.length === 0 ? (
          "עוד אף אחד לא מביא"
        ) : (
          <>
            מביאים: <Num>{item.people.length}</Num>
          </>
        )
      ) : left > 0 ? (
        <>
          נשאר <Num>{left}</Num> מתוך <Num>{item.needed}</Num>
        </>
      ) : (
        "כבר מכוסה"
      ),
      item.category,
    );
  } else if (item.kind === "shopping") {
    parts.push(item.bought ? "נקנה" : "עוד לא נקנה");
    if (item.quantity) parts.push(<bdi>{item.quantity}</bdi>);
    parts.push(item.category);
  } else {
    if (item.toBuy > 0) {
      parts.push(
        item.toBuy === 1 ? (
          "חסר מצרך אחד"
        ) : (
          <>
            חסרים <Num>{item.toBuy}</Num> מצרכים
          </>
        ),
      );
    } else if (item.ingredients > 0) {
      parts.push("כל המצרכים נקנו");
    }
    const [weekday, date] = formatTripDay(item.date).split(" ");
    parts.push(
      <>
        {weekday} <Num>{date}</Num>, {SLOT_LABELS[item.slot] ?? item.slot}
      </>,
    );
  }
  return parts.map((p, i) => (
    <span key={i}>
      {i > 0 && " · "}
      {p}
    </span>
  ));
}

/** Up to three faces, then "+N". */
function Faces({ people }: { people: Person[] }) {
  const shown = people.slice(0, 3);
  const more = people.length - shown.length;
  return (
    <div className="flex shrink-0 items-center">
      {shown.map((p, i) => (
        <UserAvatar
          key={p.id}
          name={p.name}
          slug={p.slug}
          avatarUrl={p.avatarUrl}
          size={32}
          className={cn("ring-peach", i > 0 && "-ms-2")}
        />
      ))}
      {more > 0 && (
        <span dir="ltr" className="ms-1 text-[13px] font-bold text-peach-ink">
          +{more}
        </span>
      )}
    </div>
  );
}

function ThreadSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3.5">
      {[0, 1].map((i) => (
        <div key={i} className="flex gap-2.5">
          <span className="size-9 shrink-0 animate-pulse rounded-full bg-line" />
          <span className="h-16 flex-1 animate-pulse rounded-[20px] bg-line" />
        </div>
      ))}
    </div>
  );
}

/** The sheet's one main action: send, or save while editing. */
function SendButton({ busy, editing, empty }: { busy: boolean; editing: boolean; empty: boolean }) {
  return (
    <button
      type="submit"
      disabled={busy || empty}
      aria-busy={busy || undefined}
      aria-label={editing ? "שמירה" : "לשלוח"}
      className={cn(
        "grid size-[52px] shrink-0 place-items-center rounded-full bg-cta text-on-cta transition active:scale-95 disabled:pointer-events-none",
        busy ? "opacity-60" : "disabled:opacity-45",
      )}
    >
      {/* The plane points the way Hebrew reads. */}
      {editing ? <Check className="size-5" /> : <Send className="size-5 -scale-x-100" />}
    </button>
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
    <div className="mb-2 flex h-11 items-center gap-2 rounded-full border-[1.5px] border-line bg-surface ps-4 text-[13px] font-bold text-ink">
      <Pencil aria-hidden className="size-3.5 text-muted" />
      <span className="flex-1">עריכת הודעה</span>
      <button
        type="button"
        onClick={onCancel}
        aria-label="ביטול עריכה"
        className="tap grid place-items-center rounded-full text-muted active:scale-95"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

/** Small icon buttons on a bubble: drawn 24px, stretched to 44px to tap. */
const BUBBLE_ICON =
  "relative grid size-6 shrink-0 place-items-center text-muted after:absolute after:-inset-2.5 after:content-[''] active:scale-95";

/** The pencil on your own bubble. */
export function EditButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label="לערוך הודעה" className={cn(BUBBLE_ICON, className)}>
      <Pencil className="size-3.5" />
    </button>
  );
}

function DeleteButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label="למחוק הודעה" className={cn(BUBBLE_ICON, className)}>
      <Trash2 className="size-3.5" />
    </button>
  );
}

/** Beside the time on an edited message. Inherits the time's size and colour. */
export const Edited = ({ at }: { at: string | null }) => (at ? <span> (נערך)</span> : null);

/**
 * The text box with tagging: type @ and the matching people (then @כולם)
 * appear as chips above it.
 *
 * The chips only insert text: the server decides who was actually mentioned
 * by re-reading the body, so deleting "@ניר" before sending really does undo
 * the mention.
 */
export function MentionBox({
  value,
  onChange,
  people,
  boxRef,
  rows = 1,
  placeholder = "לכתוב תגובה… אפשר לתייג עם @",
  onEscape,
  trailing,
}: {
  value: string;
  onChange: (v: string) => void;
  people: Person[];
  boxRef: React.RefObject<HTMLTextAreaElement | null>;
  rows?: number;
  placeholder?: string;
  /** Escape while no chips are showing, e.g. to leave edit mode. Stops the sheet closing too. */
  onEscape?: () => void;
  /** Beside the box, like the send button, so the chips run the full width above both. */
  trailing?: React.ReactNode;
}) {
  // The word being typed after an @, if the caret sits inside one.
  const partial = /(?:^|\s)@([^\s@]*)$/.exec(value)?.[1];
  const matches =
    partial === undefined ? [] : people.filter((p) => p.name.startsWith(partial)).slice(0, 5);
  const offerEveryone = partial !== undefined && EVERYONE.startsWith(partial);
  // People first, then everyone: the order the chips are drawn in.
  const options = [...matches.map((p) => p.name), ...(offerEveryone ? [EVERYONE] : [])];
  const [cursor, setCursor] = useState(0);
  const active = Math.min(cursor, Math.max(options.length - 1, 0));

  // Grows with the text to about five lines, then scrolls.
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight + el.offsetHeight - el.clientHeight, 140)}px`;
  }, [value, boxRef]);

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

  // 36px drawn, 44px to tap; the row's own padding keeps the tap box unclipped.
  const chip =
    "relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full text-sm transition active:scale-95 after:absolute after:-inset-y-1 after:inset-x-0 after:content-['']";

  return (
    <div className="flex flex-col gap-1">
      {options.length > 0 && (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 py-1">
          {matches.map((p, i) => (
            <button
              key={p.id}
              type="button"
              // Keep the focus (and the phone's keyboard) in the box.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(p.name)}
              className={cn(
                chip,
                "border-[1.5px] border-line bg-surface ps-1 pe-3 font-semibold text-ink",
                active === i && "ring-2 ring-cta",
              )}
            >
              <UserAvatar name={p.name} slug={p.slug} avatarUrl={p.avatarUrl} size={28} className="ring-0" />
              {p.name}
            </button>
          ))}
          {offerEveryone && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(EVERYONE)}
              className={cn(
                chip,
                "bg-coral px-3 font-bold text-coral-ink",
                active === matches.length && "ring-2 ring-cta",
              )}
            >
              @{EVERYONE}
            </button>
          )}
        </div>
      )}
      <div className="flex items-end gap-2">
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
          className="block min-h-[52px] min-w-0 flex-1 resize-none rounded-[26px] border-[1.5px] border-line bg-surface px-[18px] py-[13px] text-base leading-[22px] text-ink outline-none transition placeholder:text-muted focus:border-cta focus:ring-1 focus:ring-cta"
        />
        {trailing}
      </div>
    </div>
  );
}

/** Renders @name and @כולם in the link colour, leaving the rest of the text alone. */
export function highlight(body: string, people: Person[]) {
  if (people.length === 0) return body;
  const names = [EVERYONE, ...people.map((p) => p.name)]
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .sort((a, b) => b.length - a.length)
    .join("|");
  return body.split(new RegExp(`(@(?:${names}))`, "u")).map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className="font-bold text-link">
        {part}
      </span>
    ) : (
      part
    ),
  );
}
