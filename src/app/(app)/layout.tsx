import { redirect } from "next/navigation";

import { BottomNav } from "@/components/bottom-nav";
import { MentionBanner } from "@/components/notifications";
import { OnboardingGate } from "@/components/onboarding";
import { Toaster } from "@/components/toast";
import { WhatsNew } from "@/components/whats-new";
import { WidgetBoundary } from "@/components/widget-boundary";
import { getCurrentUser } from "@/lib/session";

/**
 * Shell for every signed-in page. The proxy already redirects anonymous
 * requests, but this re-checks server-side: the proxy is an optimistic gate,
 * not the authorization boundary (Next's own docs are explicit about that).
 *
 * Each widget gets its own WidgetBoundary: they sit above (app)/error.tsx, so
 * one of them throwing would otherwise blank every screen.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  return (
    <>
      <WidgetBoundary name="Toaster">
        <Toaster />
      </WidgetBoundary>
      {/* Mounted here rather than per page so a tag that lands while you are
          on the gear list still reaches you. */}
      <WidgetBoundary name="MentionBanner">
        <MentionBanner />
      </WidgetBoundary>
      {/* First login only — finishing stamps users.onboarded_at. */}
      <WidgetBoundary name="OnboardingGate">
        <OnboardingGate initialOpen={me.onboardedAt === null} />
      </WidgetBoundary>
      {/* One pop-up per deployed commit; see [no-popup] in /api/release.
          Also runs the reload guard for tabs left on an old deploy. */}
      <WidgetBoundary name="WhatsNew">
        <WhatsNew />
      </WidgetBoundary>
      {me.isViewer && (
        <div className="bg-white/10 px-4 py-1.5 text-center text-xs font-semibold text-white/70">
          👀 מצב צפייה בלבד - אפשר לראות הכול, אי אפשר לערוך
        </div>
      )}
      {/* pb clears the fixed bottom nav plus the home indicator. */}
      <div className="mx-auto w-full max-w-md px-5 pt-7 pb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)]">
        {children}
      </div>
      <WidgetBoundary name="BottomNav">
        <BottomNav />
      </WidgetBoundary>
    </>
  );
}
