import { redirect } from "next/navigation";

import { BottomNav } from "@/components/bottom-nav";
import { Toaster } from "@/components/toast";
import { getCurrentUser } from "@/lib/session";

/**
 * Shell for every signed-in page. The proxy already redirects anonymous
 * requests, but this re-checks server-side: the proxy is an optimistic gate,
 * not the authorization boundary (Next's own docs are explicit about that).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  return (
    <>
      <Toaster />
      {/* pb clears the fixed bottom nav plus the home indicator. */}
      <div className="mx-auto w-full max-w-md px-5 pt-7 pb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)]">
        {children}
      </div>
      <BottomNav />
    </>
  );
}
