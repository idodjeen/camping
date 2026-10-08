import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { GroupAdmin } from "@/components/group-admin";
import { Toaster } from "@/components/toast";
import { loadGroupAccess } from "@/lib/access";
import { groupDetail } from "@/lib/group-admin";
import { appOrigin } from "@/lib/groups";
import { requirePageUser } from "@/lib/session";

export const metadata: Metadata = { title: "ניהול הקבוצה" };

/**
 * The group admin's page: the group's people and roles, its trips, and who is
 * on each. Outside any trip like /admin, so no header or bottom nav; the way
 * back is `/`, which reopens the last trip. Same gate as /api/g/[groupId]:
 * outsiders get 404, members who aren't admins a "no permission" card.
 */
export default async function GroupAdminPage({ params }: { params: Promise<{ groupId: string }> }) {
  const me = await requirePageUser();
  const access = await loadGroupAccess(me, Number((await params).groupId));
  if (!access) notFound();

  if (!access.isAdmin) {
    // The API answers 403; the page says the same in words.
    return (
      <main className="mx-auto w-full max-w-md px-5 pt-10">
        <div className="glass rounded-glass p-8 text-center">
          <h1 className="text-xl font-bold">אין הרשאה</h1>
          <p className="mt-2 text-sm text-white/60">הדף הזה רק למנהלי הקבוצה.</p>
          <Link href="/" className="tap mt-6 inline-grid place-items-center rounded-2xl bg-white/5 px-5 text-sm font-semibold">
            חזרה לטיול
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-md px-5 pt-[calc(env(safe-area-inset-top,0px)+1.25rem)] pb-10">
      <Toaster />
      <Link
        href="/"
        className="tap -ms-2 mb-2 inline-flex items-center gap-1 rounded-xl px-2 text-sm font-semibold text-white/55"
      >
        <ChevronRight className="size-4 ltr:rotate-180" />
        חזרה לטיול
      </Link>
      <p className="text-xs font-semibold text-white/45">ניהול הקבוצה</p>
      <h1 className="mb-6 text-2xl font-bold">{access.group.name}</h1>
      <GroupAdmin
        initial={await groupDetail(access.group.id)}
        me={{ id: me.id, isSuperAdmin: me.isSuperAdmin }}
        link={await appOrigin()}
      />
    </main>
  );
}
