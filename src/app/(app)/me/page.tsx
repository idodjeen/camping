"use client";

import { BookOpen, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";

import { AdminNotify } from "@/components/admin-notify";
import { NotificationPrefs, type NotifyPrefs } from "@/components/notification-prefs";
import { NotificationsBell } from "@/components/notifications";
import { Onboarding } from "@/components/onboarding";
import { PageTitle, SkeletonList } from "@/components/skeletons";
import { UserAvatar } from "@/components/user-avatar";
import { NOTIFICATIONS_KEY, fetcher, swrConfig } from "@/lib/api";

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

  if (isLoading && !data) {
    return (
      <>
        <PageTitle title="חשבון" />
        <SkeletonList rows={5} />
      </>
    );
  }
  if (!data) return null;

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
      </header>

      {data.user.isAdmin && <AdminNotify />}

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
