import { MapPin, Navigation } from "lucide-react";

/** Navigation hand-off. Both links open the native app when it is installed. */
export function LocationCard({
  lat,
  lng,
  locationName,
}: {
  lat: number;
  lng: number;
  locationName: string | null;
}) {
  const waze = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  const maps = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-tile bg-sage text-sage-ink">
          <MapPin className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-base font-bold text-ink">{locationName ?? "נקודת המפגש"}</p>
          <p className="text-[13px] tabular-nums text-muted" dir="ltr">
            {lat.toFixed(4)}, {lng.toFixed(4)}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <a
          href={waze}
          target="_blank"
          rel="noreferrer"
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full border-[1.5px] border-line bg-canvas text-[15px] font-bold text-ink transition active:scale-95"
        >
          <Navigation className="size-4" aria-hidden />
          Waze
        </a>
        <a
          href={maps}
          target="_blank"
          rel="noreferrer"
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full border-[1.5px] border-line bg-canvas text-[15px] font-bold text-ink transition active:scale-95"
        >
          <MapPin className="size-4" aria-hidden />
          Google Maps
        </a>
      </div>
    </div>
  );
}
