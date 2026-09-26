"use client";

import { motion } from "framer-motion";
import { BookOpen, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";

import { AdminNotify } from "@/components/admin-notify";
import { CopyButton } from "@/components/copy-button";
import { NotificationPrefs, type NotifyPrefs } from "@/components/notification-prefs";
import { NotificationsBell } from "@/components/notifications";
import { Onboarding } from "@/components/onboarding";
import { CheckBox, PersonalList } from "@/components/personal-list";
import { PageTitle, SkeletonList } from "@/components/skeletons";
import { toast } from "@/components/toast";
import { UserAvatar } from "@/components/user-avatar";
import { ApiError, NOTIFICATIONS_KEY, fetcher, send, swrConfig } from "@/lib/api";
import { burstFrom } from "@/lib/confetti";
import { formatMyList } from "@/lib/format-lists";
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
  notify: NotifyPrefs;
};

export default function MePage() {
  const { data, isLoading, mutate } = useSWR<Payload>("/api/me", fetcher, swrConfig);
  const { mutate: globalMutate } = useSWRConfig();
  const [guide, setGuide] = useState(false);

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

  if (isLoading && !data) {
    return (
      <>
        <PageTitle title="שלי" />
        <SkeletonList rows={5} />
      </>
    );
  }
  if (!data) return null;

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

      <PersonalList />

      <NotificationPrefs
        prefs={data.notify}
        // The bell must drop (or regain) rows right away, not on the next 15s poll.
        onChanged={() => void Promise.all([mutate(), globalMutate(NOTIFICATIONS_KEY)])}
      />

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

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-brand-400/30 bg-brand-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-brand-300">
      {children}
    </span>
  );
}
