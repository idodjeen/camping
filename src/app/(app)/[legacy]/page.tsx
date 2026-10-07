import type { Route } from "next";
import { notFound, redirect } from "next/navigation";

import { requirePageUser } from "@/lib/session";
import { homeTripId } from "@/lib/trips";

/**
 * Screens from before trips had their own URLs: bookmarks, the installed
 * app's start URL, and push notifications already sitting on phones all point
 * at /gear, /chat and so on. Each opens the same screen in your home trip,
 * keeping the query string (?filter=done, ?thread=...).
 */
const SCREENS = new Set(["gear", "meals", "shopping", "expenses", "chat", "room", "leaderboard", "me"]);

export default async function LegacyScreen({
  params,
  searchParams,
}: {
  params: Promise<{ legacy: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { legacy } = await params;
  if (!SCREENS.has(legacy)) notFound();

  const user = await requirePageUser();
  const tripId = await homeTripId(user);
  if (!tripId) redirect("/trips");

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      query.append(key, v);
    }
  }
  const qs = query.toString();
  // SCREENS above is the whitelist that makes this cast safe.
  redirect(`/t/${tripId}/${legacy}${qs ? `?${qs}` : ""}` as Route);
}
