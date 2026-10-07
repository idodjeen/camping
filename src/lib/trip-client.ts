"use client";

import type { Route } from "next";
import { useParams } from "next/navigation";

/**
 * The trip the current screen belongs to, read from the /t/[tripId] URL, and
 * the paths that stay inside it. Every trip API call and in-app link goes
 * through here, so nothing on a screen can quietly talk to another trip.
 *
 *   api("/gear")   -> "/api/t/7/gear"
 *   page("/gear")  -> "/t/7/gear"      page("/") -> "/t/7"
 *   local("/t/7/gear") -> "/gear"      (for tab highlighting)
 */
export function useTrip() {
  const { tripId } = useParams<{ tripId: string }>();
  const base = `/t/${tripId}`;
  return {
    id: Number(tripId),
    api: (path: string) => `/api${base}${path}`,
    // Cast because typedRoutes cannot see a runtime trip id; every caller
    // passes a literal screen path, which is what keeps it honest.
    page: (path: string) => (path === "/" ? base : `${base}${path}`) as Route,
    local: (pathname: string) =>
      pathname.startsWith(base) ? pathname.slice(base.length) || "/" : pathname,
  };
}
