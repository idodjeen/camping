"use client";

import { useEffect } from "react";

import { LAST_TRIP_COOKIE } from "@/lib/last-trip";

/**
 * Stamps the trip being viewed into a cookie, so `/` and pre-trip links
 * (/gear, old push notifications) reopen it. Set from the client because a
 * Server Component layout cannot write cookies.
 */
export function RememberTrip({ id }: { id: number }) {
  useEffect(() => {
    document.cookie = `${LAST_TRIP_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
  }, [id]);
  return null;
}
