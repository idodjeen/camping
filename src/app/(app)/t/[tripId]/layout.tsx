import { notFound } from "next/navigation";

import { BottomNav } from "@/components/bottom-nav";
import { MentionBanner } from "@/components/notifications";
import { OnboardingGate } from "@/components/onboarding";
import { RememberTrip } from "@/components/remember-trip";
import { Toaster } from "@/components/toast";
import { WhatsNew } from "@/components/whats-new";
import { WidgetBoundary } from "@/components/widget-boundary";
import { loadTripAccess } from "@/lib/access";
import { requirePageUser } from "@/lib/session";

/**
 * Shell for every screen of one trip. The proxy only checks that a session
 * exists; this is where a page learns whether *this* person may see *this*
 * trip. Anyone outside its group gets the same 404 as a trip that does not
 * exist, matching the API.
 *
 * Each widget gets its own WidgetBoundary: they sit above this segment's
 * error.tsx, so one of them throwing would otherwise blank every screen.
 */
export default async function TripLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tripId: string }>;
}) {
  const me = await requirePageUser();
  const access = await loadTripAccess(me, Number((await params).tripId));
  if (!access) notFound();

  return (
    <>
      <WidgetBoundary name="RememberTrip">
        <RememberTrip id={access.trip.id} />
      </WidgetBoundary>
      <WidgetBoundary name="Toaster">
        <Toaster />
      </WidgetBoundary>
      {/* Mounted here rather than per page so a tag that lands while you are
          on the gear list still reaches you. */}
      <WidgetBoundary name="MentionBanner">
        <MentionBanner />
      </WidgetBoundary>
      {/* First login only; finishing stamps users.onboarded_at. */}
      <WidgetBoundary name="OnboardingGate">
        <OnboardingGate initialOpen={me.onboardedAt === null} />
      </WidgetBoundary>
      {/* One pop-up per deployed commit; see [no-popup] in /api/release.
          Also runs the reload guard for tabs left on an old deploy. */}
      <WidgetBoundary name="WhatsNew">
        <WhatsNew />
      </WidgetBoundary>
      {!access.canWrite && (
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
