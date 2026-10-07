import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";

import { AdminGroups } from "@/components/admin-groups";
import { Toaster } from "@/components/toast";
import { listGroups } from "@/lib/groups";
import { requirePageUser } from "@/lib/session";

export const metadata: Metadata = { title: "ניהול קבוצות" };

/**
 * The super admin's page: every group, and creating a new one with its
 * people. Outside any trip, so it has no header or bottom nav; the way back is
 * `/`, which reopens the last trip. Group admins run their own group at
 * /g/[groupId] (phase 5), not here.
 */
export default async function AdminPage() {
  const me = await requirePageUser();

  if (!me.isSuperAdmin) {
    // The API answers 403; the page says the same in words.
    return (
      <main className="mx-auto w-full max-w-md px-5 pt-10">
        <div className="glass rounded-glass p-8 text-center">
          <h1 className="text-xl font-bold">אין הרשאה</h1>
          <p className="mt-2 text-sm text-white/60">הדף הזה רק למנהל המערכת.</p>
          <Link href="/" className="tap mt-6 inline-grid place-items-center rounded-2xl bg-white/5 px-5 text-sm font-semibold">
            חזרה לטיול
          </Link>
        </div>
      </main>
    );
  }

  // The address this request came in on, so a preview's message links to the
  // preview and production's to production.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.)/.test(host) ? "http" : "https");

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
      <h1 className="mb-6 text-2xl font-bold">ניהול קבוצות</h1>
      <AdminGroups initial={await listGroups()} link={`${proto}://${host}`} />
    </main>
  );
}
