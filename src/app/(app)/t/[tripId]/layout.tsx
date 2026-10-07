import { notFound } from "next/navigation";

import { BottomNav } from "@/components/bottom-nav";
import { MentionBanner } from "@/components/notifications";
import { OnboardingGate } from "@/components/onboarding";
import { RememberTrip } from "@/components/remember-trip";
import { Toaster } from "@/components/toast";
import { WhatsNew } from "@/components/whats-new";
import { loadTripAccess } from "@/lib/access";
import { requirePageUser } from "@/lib/session";

/**
 * Shell for every screen of one trip. The proxy only checks that a session
 * exists; this is where a page learns whether *this* person may see *this*
 * trip. Anyone outside its group gets the same 404 as a trip that does not
 * exist, matching the API.
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
      <RememberTrip id={access.trip.id} />
      <Toaster />
      {/* Mounted here rather than per page so a tag that lands while you are
          on the gear list still reaches you. */}
      <MentionBanner />
      {/* First login only; finishing stamps users.onboarded_at. */}
      <OnboardingGate initialOpen={me.onboardedAt === null} />
      {/* One pop-up per deployed commit; see [no-popup] in /api/release. */}
      <WhatsNew />
      {!access.canWrite && (
        <div className="bg-white/10 px-4 py-1.5 text-center text-xs font-semibold text-white/70">
          👀 מצב צפייה בלבד - אפשר לראות הכול, אי אפשר לערוך
        </div>
      )}
      {/* pb clears the fixed bottom nav plus the home indicator. */}
      <div className="mx-auto w-full max-w-md px-5 pt-7 pb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)]">
        {children}
      </div>
      <BottomNav />
    </>
  );
}
