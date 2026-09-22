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
    <div className="glass rounded-glass p-4">
      <div className="mb-3 flex items-center gap-2">
        <MapPin className="size-4 text-brand-300" />
        <span className="text-sm font-semibold">{locationName ?? "נקודת המפגש"}</span>
        <span className="text-[11px] tabular-nums text-white/30" dir="ltr">
          {lat.toFixed(4)}, {lng.toFixed(4)}
        </span>
      </div>
      <div className="flex gap-2">
        <a
          href={waze}
          target="_blank"
          rel="noreferrer"
          className="tap flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#33ccff]/15 text-sm font-semibold text-[#7fe0ff] transition active:scale-95"
        >
          <Navigation className="size-4" />
          Waze
        </a>
        <a
          href={maps}
          target="_blank"
          rel="noreferrer"
          className="tap flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/8 text-sm font-semibold text-white/80 transition active:scale-95"
        >
          <MapPin className="size-4" />
          Google Maps
        </a>
      </div>
    </div>
  );
}
