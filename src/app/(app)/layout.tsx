import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";
import { MentionBanner } from "@/components/notifications";
import { OnboardingGate } from "@/components/onboarding";
import { Toaster } from "@/components/toast";
import { WhatsNew } from "@/components/whats-new";
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
      {/* Mounted here rather than per page so a tag that lands while you are
          on the gear list still reaches you. */}
      <MentionBanner />
      {/* First login only — finishing stamps users.onboarded_at. */}
      <OnboardingGate initialOpen={me.onboardedAt === null} />
      {/* One pop-up per deployed commit; see [no-popup] in /api/release. */}
      <WhatsNew />
      <AppHeader />
      {/* pb clears the fixed bottom nav plus the home indicator. The header is
          sticky and carries its own top inset, so the content starts tight. */}
      <div className="mx-auto w-full max-w-md px-5 pt-4 pb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)]">
        {children}
      </div>
      <BottomNav />
    </>
  );
}
