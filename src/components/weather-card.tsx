"use client";

import { CloudRain, Droplets, Wind } from "lucide-react";
import useSWR from "swr";

import { fetcher } from "@/lib/api";
import { formatTripDay } from "@/lib/dates";

type Day = { date: string; max: number; min: number; rain: number; wind: number };
type Payload = { available: boolean; days: Day[] };

export function WeatherCard() {
  // Hourly on the server; no need to poll this one on the 15s cadence.
  const { data, isLoading } = useSWR<Payload>("/api/weather", fetcher, {
    refreshInterval: 0,
    revalidateOnFocus: false,
  });

  if (isLoading && !data) {
    return <div className="glass h-28 animate-pulse rounded-glass" aria-hidden />;
  }

  if (!data?.available) {
    return (
      <div className="glass rounded-glass p-5 text-center text-sm text-white/45">
        התחזית תופיע קרוב למועד
      </div>
    );
  }

  return (
    <div className="glass rounded-glass p-4">
      <div className="grid grid-cols-3 gap-2">
        {data.days.map((d) => (
          <div key={d.date} className="rounded-xl bg-white/4 p-3 text-center">
            <p className="text-[11px] font-medium text-white/50">{formatTripDay(d.date)}</p>
            <p className="mt-1.5 text-lg font-bold tabular-nums">
              {d.max}°<span className="text-sm font-medium text-white/40">/{d.min}°</span>
            </p>
            <div className="mt-1.5 flex items-center justify-center gap-2 text-[10px] text-white/45">
              <span className="inline-flex items-center gap-0.5">
                <Droplets className="size-3" />
                {d.rain}%
              </span>
              <span className="inline-flex items-center gap-0.5">
                <Wind className="size-3" />
                {d.wind}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* A soft heads-up rather than an alarm — it is a camping trip. */}
      {data.days.some((d) => d.rain >= 40) && (
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-amber-300/80">
          <CloudRain className="size-3.5" />
          יש סיכוי לגשם — שווה לקחת ברזנט
        </p>
      )}
    </div>
  );
}
