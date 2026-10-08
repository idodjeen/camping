"use client";

import { CloudRain, Droplets, Wind } from "lucide-react";
import useSWR from "swr";

import { fetcher } from "@/lib/api";
import { formatTripDay } from "@/lib/dates";
import { useTrip } from "@/lib/trip-client";

type Day = { date: string; max: number; min: number; rain: number; wind: number };
type Payload = { available: boolean; days: Day[] };

export function WeatherCard() {
  const { api } = useTrip();
  // Hourly on the server; no need to poll this one on the 15s cadence.
  const { data, isLoading } = useSWR<Payload>(api("/weather"), fetcher, {
    refreshInterval: 0,
    revalidateOnFocus: false,
  });

  if (isLoading && !data) {
    return <div className="card h-32 animate-pulse" aria-hidden />;
  }

  if (!data?.available) {
    return (
      <div className="card p-5 text-center text-sm text-muted">התחזית תופיע קרוב למועד</div>
    );
  }

  return (
    <div className="card p-4">
      <p className="mb-3 px-1 font-display text-lg text-ink">מזג האוויר</p>
      <div className="grid grid-cols-3 gap-2">
        {data.days.map((d) => (
          <div key={d.date} className="rounded-tile bg-canvas p-3 text-center">
            <p className="text-[13px] font-semibold text-muted">{formatTripDay(d.date)}</p>
            <p className="mt-1 font-display text-xl tabular-nums text-ink">
              {d.max}°<span className="text-sm text-muted">/{d.min}°</span>
            </p>
            <div className="mt-1.5 flex items-center justify-center gap-2 text-[13px] text-muted">
              <span className="inline-flex items-center gap-0.5" aria-label={`סיכוי לגשם ${d.rain}%`}>
                <Droplets className="size-3.5" aria-hidden />
                {d.rain}%
              </span>
              <span className="inline-flex items-center gap-0.5" aria-label={`רוח ${d.wind}`}>
                <Wind className="size-3.5" aria-hidden />
                {d.wind}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* A soft heads-up rather than an alarm: it is a camping trip. */}
      {data.days.some((d) => d.rain >= 40) && (
        <p className="mt-3 flex items-center justify-center gap-1.5 rounded-tile bg-amber px-3 py-2 text-[13px] font-semibold text-amber-ink">
          <CloudRain className="size-4" aria-hidden />
          יש סיכוי לגשם - שווה לקחת ברזנט
        </p>
      )}
    </div>
  );
}
