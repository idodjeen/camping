import { eq } from "drizzle-orm";

import { db } from "@/db";
import { trip } from "@/db/schema";
import { handle, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

type Daily = {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_probability_max: number[];
  wind_speed_10m_max: number[];
};

/**
 * Open-Meteo forecast for the trip days. No API key, no account.
 *
 * Cached for an hour via `next.revalidate`: five people polling every 15
 * seconds would otherwise hammer a free service for data that changes hourly
 * at best. The cache is shared across all users, not per-request.
 *
 * Open-Meteo only forecasts ~16 days out, so before that window it returns
 * nothing for these dates and we tell the user to check back closer to the time.
 */
export function GET() {
  return handle(async () => {
    await requireUser();

    const [t] = await db.select().from(trip).where(eq(trip.id, 1));
    if (!t) return { available: false as const, days: [] };

    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(t.lat));
    url.searchParams.set("longitude", String(t.lng));
    url.searchParams.set(
      "daily",
      "temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max",
    );
    url.searchParams.set("timezone", "Asia/Jerusalem");
    url.searchParams.set("start_date", t.startDate);
    url.searchParams.set("end_date", t.endDate);

    try {
      const res = await fetch(url, { next: { revalidate: 3600 } });
      if (!res.ok) return { available: false as const, days: [] };

      const json = (await res.json()) as { daily?: Daily };
      const d = json.daily;
      if (!d?.time?.length) return { available: false as const, days: [] };

      const days = d.time.map((date, i) => ({
        date,
        max: Math.round(d.temperature_2m_max[i]),
        min: Math.round(d.temperature_2m_min[i]),
        rain: Math.round(d.precipitation_probability_max[i] ?? 0),
        wind: Math.round(d.wind_speed_10m_max[i] ?? 0),
      }));
      // A forecast of all-nulls means the dates are still beyond the horizon.
      const available = days.some((x) => Number.isFinite(x.max));
      return { available, days: available ? days : [] };
    } catch {
      // Never let a third-party outage break the dashboard.
      return { available: false as const, days: [] };
    }
  });
}
