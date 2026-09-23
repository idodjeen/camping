import { eq } from "drizzle-orm";

import { db } from "@/db";
import { trip } from "@/db/schema";

export type WeatherDay = { date: string; max: number; min: number; rain: number; wind: number };

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
 * Cached for an hour via `next.revalidate` and shared across all callers, so
 * five phones polling does not hammer a free service for data that changes
 * hourly at best. Extracted here so the countdown email and the /api/weather
 * route use one implementation rather than two that can drift.
 */
export async function getForecast(): Promise<{ available: boolean; days: WeatherDay[] }> {
  const [t] = await db.select().from(trip).where(eq(trip.id, 1));
  if (!t) return { available: false, days: [] };

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
    if (!res.ok) return { available: false, days: [] };

    const d = ((await res.json()) as { daily?: Daily }).daily;
    if (!d?.time?.length) return { available: false, days: [] };

    const days = d.time.map((date, i) => ({
      date,
      max: Math.round(d.temperature_2m_max[i]),
      min: Math.round(d.temperature_2m_min[i]),
      rain: Math.round(d.precipitation_probability_max[i] ?? 0),
      wind: Math.round(d.wind_speed_10m_max[i] ?? 0),
    }));
    // All-null values mean the dates are still beyond the forecast horizon.
    const available = days.some((x) => Number.isFinite(x.max));
    return { available, days: available ? days : [] };
  } catch {
    // Never let a third-party outage break the dashboard or an email.
    return { available: false, days: [] };
  }
}
