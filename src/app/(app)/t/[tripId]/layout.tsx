import { notFound } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";
import { MentionBanner } from "@/components/notifications";
import { OnboardingGate } from "@/components/onboarding";
import { PushSync } from "@/components/push-sync";
import { RememberTrip } from "@/components/remember-trip";
import { Toaster } from "@/components/toast";
import { WhatsNew } from "@/components/whats-new";
import { WidgetBoundary } from "@/components/widget-boundary";
import { loadTripAccess } from "@/lib/access";
import { requirePageUser } from "@/lib/session";
import { accessibleTrips } from "@/lib/trips";

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
  const [access, trips] = await Promise.all([
    loadTripAccess(me, Number((await params).tripId)),
    accessibleTrips(me),
  ]);
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
      {/* Keeps this device's push subscription on the server. */}
      <WidgetBoundary name="PushSync">
        <PushSync />
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
      {/* Outside template.tsx on purpose: the header stays put while the
          screen under it changes. The menu's roles come from here, already
          read, so its admin rows don't pop in after a request. */}
      <WidgetBoundary name="AppHeader">
        <AppHeader
          trips={trips.map((t) => ({ id: t.id, name: t.name, groupId: t.groupId, groupName: t.groupName }))}
          roles={{ isAdmin: access.isAdmin, isSuperAdmin: me.isSuperAdmin }}
        />
      </WidgetBoundary>
      {/* Below the header, so it is never under the status bar; it scrolls away. */}
      {!access.canWrite && (
        <div className="mx-auto mt-2 w-[calc(100%-2rem)] max-w-md rounded-full bg-amber px-4 py-2 text-center text-[13px] font-bold text-amber-ink">
          צפייה בלבד - אפשר לראות הכול, אי אפשר לערוך
        </div>
      )}
      {/* The header is sticky and in the flow, so the top needs no inset; the
          bottom clears the fixed nav (its height includes the home indicator). */}
      <div className="mx-auto w-full max-w-md px-5 pt-5 pb-[calc(var(--bottom-nav-h)+2rem)]">
        {children}
      </div>
      <WidgetBoundary name="BottomNav">
        <BottomNav />
      </WidgetBoundary>
    </>
  );
}
