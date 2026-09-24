"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Check, ListPlus, Loader2, LogOut, Pencil, Plus, Trash2, X } from "lucide-react";
import { signOut } from "next-auth/react";
import { useState } from "react";
import useSWR from "swr";

import { AdminNotify } from "@/components/admin-notify";
import { CopyButton } from "@/components/copy-button";
import { NotificationsBell } from "@/components/notifications";
import { Onboarding } from "@/components/onboarding";
import { PageTitle, SkeletonList } from "@/components/skeletons";
import { toast } from "@/components/toast";
import { UserAvatar } from "@/components/user-avatar";
import { ApiError, fetcher, send, swrConfig } from "@/lib/api";
import { burstFrom } from "@/lib/confetti";
import { formatMyList } from "@/lib/format-lists";
import { PERSONAL_TEMPLATE } from "@/lib/personal-template";
import { cn } from "@/lib/utils";

type Payload = {
  user: {
    id: number;
    name: string;
    slug: string;
    avatarUrl: string | null;
    isAdmin: boolean;
    isShopper: boolean;
  };
  claims: {
    itemId: number;
    qty: number;
    isPacked: boolean;
    name: string;
    qtyLabel: string | null;
    categoryName: string;
  }[];
  personal: { id: number; name: string; isPacked: boolean }[];
};

export default function MePage() {
  const { data, isLoading, mutate } = useSWR<Payload>("/api/me", fetcher, swrConfig);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [guide, setGuide] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  const optimistic = (patch: (p: Payload) => Payload) => (data ? patch(data) : undefined);

  async function togglePacked(itemId: number, next: boolean, el: Element | null) {
    if (next) burstFrom(el);
    try {
      await mutate(
        async () => {
          await send(`/api/gear/${itemId}/claim`, "PATCH", { isPacked: next });
          return fetcher<Payload>("/api/me");
        },
        {
          optimisticData: optimistic((p) => ({
            ...p,
            claims: p.claims.map((c) => (c.itemId === itemId ? { ...c, isPacked: next } : c)),
          })),
          rollbackOnError: true,
          revalidate: false,
        },
      );
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "לא הצלחנו לעדכן");
    }
  }

  async function addPersonal(e: React.FormEvent) {
    e.preventDefault();
    const name = draft.trim();
    if (!name) return;
    setAdding(true);
    setDraft("");
    try {
      await mutate(async () => {
        await send("/api/personal", "POST", { name });
        return fetcher<Payload>("/api/me");
      }, { revalidate: false });
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "לא הצלחנו להוסיף");
      setDraft(name);
    } finally {
      setAdding(false);
    }
  }

  async function togglePersonal(id: number, next: boolean, el: Element | null) {
    if (next) burstFrom(el, { small: true });
    try {
      await mutate(
        async () => {
          await send(`/api/personal/${id}`, "PATCH", { isPacked: next });
          return fetcher<Payload>("/api/me");
        },
        {
          optimisticData: optimistic((p) => ({
            ...p,
            personal: p.personal.map((i) => (i.id === id ? { ...i, isPacked: next } : i)),
          })),
          rollbackOnError: true,
          revalidate: false,
        },
      );
    } catch {
      toast("לא הצלחנו לעדכן");
    }
  }

  async function addTemplate(names: string[]) {
    setLoadingTemplate(true);
    try {
      await mutate(async () => {
        await send("/api/personal", "POST", { names });
        return fetcher<Payload>("/api/me");
      }, { revalidate: false });
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "לא הצלחנו להוסיף");
    } finally {
      setLoadingTemplate(false);
    }
  }

  function startEdit(item: { id: number; name: string }) {
    setEditingId(item.id);
    setEditDraft(item.name);
  }

  async function saveEdit(id: number) {
    const name = editDraft.trim();
    const current = data?.personal.find((i) => i.id === id);
    setEditingId(null);
    if (!name || !current || name === current.name) return;
    try {
      await mutate(
        async () => {
          await send(`/api/personal/${id}`, "PATCH", { name });
          return fetcher<Payload>("/api/me");
        },
        {
          optimisticData: optimistic((p) => ({
            ...p,
            personal: p.personal.map((i) => (i.id === id ? { ...i, name } : i)),
          })),
          rollbackOnError: true,
          revalidate: false,
        },
      );
    } catch {
      toast("לא הצלחנו לשמור");
    }
  }

  async function removePersonal(id: number) {
    try {
      await mutate(
        async () => {
          await send(`/api/personal/${id}`, "DELETE");
          return fetcher<Payload>("/api/me");
        },
        {
          optimisticData: optimistic((p) => ({
            ...p,
            personal: p.personal.filter((i) => i.id !== id),
          })),
          rollbackOnError: true,
          revalidate: false,
        },
      );
    } catch {
      toast("לא הצלחנו למחוק");
    }
  }

  if (isLoading && !data) {
    return (
      <>
        <PageTitle title="שלי" />
        <SkeletonList rows={5} />
      </>
    );
  }
  if (!data) return null;

  const missingTemplate = PERSONAL_TEMPLATE.filter(
    (n) => !data.personal.some((i) => i.name.trim() === n),
  );
  const packedCount = data.claims.filter((c) => c.isPacked).length;

  return (
    <>
      <header className="mb-6 flex items-center gap-3">
        <UserAvatar
          name={data.user.name}
          slug={data.user.slug}
          avatarUrl={data.user.avatarUrl}
          size={52}
          expandable
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xl font-bold">{data.user.name}</p>
          <div className="mt-1 flex gap-1.5">
            {data.user.isAdmin && <Badge>מנהל</Badge>}
            {data.user.isShopper && <Badge>קניות</Badge>}
          </div>
        </div>
        <NotificationsBell />
        <CopyButton
          label="הרשימה שלי"
          getText={() => formatMyList(data.user.name, data.claims, data.personal)}
        />
      </header>

      {data.user.isAdmin && <AdminNotify />}

      <section className="mb-7">
        <h2 className="mb-2 px-1 text-sm font-semibold text-white/50">
          הציוד שלי {data.claims.length > 0 && `· ${packedCount}/${data.claims.length} ארוז`}
        </h2>

        {data.claims.length === 0 ? (
          <p className="glass rounded-2xl px-4 py-5 text-center text-sm text-white/45">
            עוד לא התחייבת על ציוד.
            <br />
            קפוץ למסך הציוד ותפוס משהו.
          </p>
        ) : (
          <div className="space-y-2">
            {data.claims.map((c) => (
              <motion.div key={c.itemId} layout className="glass flex items-center gap-3 rounded-2xl p-3.5">
                <CheckBox
                  checked={c.isPacked}
                  onToggle={(el) => togglePacked(c.itemId, !c.isPacked, el)}
                  label={c.isPacked ? "לבטל ארוז" : "לסמן כארוז"}
                />
                <div className="min-w-0 flex-1">
                  <span className={cn("font-semibold", c.isPacked && "text-white/40 line-through")}>
                    {c.name}
                  </span>
                  {c.qty > 1 && (
                    <span className="ms-2 rounded-md bg-brand-500/20 px-1.5 py-0.5 text-[11px] font-bold text-brand-200">
                      ×{c.qty}
                    </span>
                  )}
                  <p className="text-[11px] text-white/35">{c.categoryName}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-1 px-1 text-sm font-semibold text-white/50">הרשימה האישית שלי</h2>
        <p className="mb-2 px-1 text-[11px] text-white/30">פרטי — אף אחד אחר לא רואה את זה.</p>

        <form onSubmit={addPersonal} className="mb-3 flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="מברשת שיניים, תרופות, בגד חם…"
            maxLength={120}
            className="tap min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 text-sm outline-none placeholder:text-white/25 focus:border-brand-400/40"
          />
          <button
            type="submit"
            disabled={adding || !draft.trim()}
            aria-label="להוסיף לרשימה"
            className="tap grid w-11 place-items-center rounded-xl bg-brand-500/20 text-brand-200 transition active:scale-95 disabled:opacity-30"
          >
            {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-5" />}
          </button>
        </form>

        {missingTemplate.length > 0 && (
          <button
            onClick={() => addTemplate(missingTemplate)}
            disabled={loadingTemplate}
            className="tap mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-brand-400/30 bg-brand-500/15 px-4 text-sm font-semibold text-brand-200 transition active:scale-[0.98] disabled:opacity-50"
          >
            {loadingTemplate ? <Loader2 className="size-4 animate-spin" /> : <ListPlus className="size-4" />}
            {data.personal.length === 0
              ? `להוסיף את רשימת הציוד האישית (${missingTemplate.length})`
              : `להוסיף פריטים חסרים מהרשימה (${missingTemplate.length})`}
          </button>
        )}

        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {data.personal.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="glass flex items-center gap-3 rounded-2xl p-3.5"
              >
                <CheckBox
                  checked={item.isPacked}
                  onToggle={(el) => togglePersonal(item.id, !item.isPacked, el)}
                  label={item.isPacked ? "לבטל ארוז" : "לסמן כארוז"}
                />
                {editingId === item.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      saveEdit(item.id);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-1.5"
                  >
                    <input
                      autoFocus
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      maxLength={120}
                      className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm outline-none focus:border-brand-400/40"
                    />
                    <button
                      type="submit"
                      aria-label="לשמור"
                      className="tap grid place-items-center rounded-lg text-aqua-200"
                    >
                      <Check className="size-4" strokeWidth={3} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      aria-label="לבטל"
                      className="tap grid place-items-center rounded-lg text-white/40"
                    >
                      <X className="size-4" />
                    </button>
                  </form>
                ) : (
                  <>
                    <span
                      className={cn(
                        "min-w-0 flex-1 break-words",
                        item.isPacked && "text-white/40 line-through",
                      )}
                    >
                      {item.name}
                    </span>
                    <button
                      onClick={() => startEdit(item)}
                      aria-label="לערוך"
                      className="tap grid place-items-center rounded-lg text-white/25 active:text-brand-200"
                    >
                      <Pencil className="size-4" />
                    </button>
                  </>
                )}
                <button
                  onClick={() => removePersonal(item.id)}
                  aria-label="למחוק"
                  className="tap grid place-items-center rounded-lg text-white/25 active:text-rose-300"
                >
                  <Trash2 className="size-4" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </section>

      <button
        onClick={() => setGuide(true)}
        className="tap mb-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-semibold text-white/60 transition active:scale-[0.98]"
      >
        <BookOpen className="size-4" />
        המדריך הקצר
      </button>

      <Onboarding open={guide} onDone={() => setGuide(false)} />

      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="tap flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-semibold text-white/60 transition active:scale-[0.98]"
      >
        <LogOut className="size-4" />
        התנתקות
      </button>
    </>
  );
}

function CheckBox({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: (el: Element | null) => void;
  label: string;
}) {
  return (
    <button
      onClick={(e) => onToggle(e.currentTarget)}
      aria-pressed={checked}
      aria-label={label}
      className={cn(
        "tap grid size-7 shrink-0 place-items-center rounded-lg border transition active:scale-90",
        checked
          ? "border-aqua-400/50 bg-aqua-500/25 text-aqua-200"
          : "border-white/15 bg-white/5 text-transparent",
      )}
    >
      <Check className="size-4" strokeWidth={3} />
    </button>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-brand-400/30 bg-brand-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-brand-300">
      {children}
    </span>
  );
}
