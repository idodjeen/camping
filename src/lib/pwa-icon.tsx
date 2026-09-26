import { ImageResponse } from "next/og";

/**
 * The tent icon from `app/icon.svg`, drawn full-bleed and square.
 *
 * iOS and Android apply their own rounded mask to home-screen icons, so baking
 * in the SVG's corner radius would leave dark slivers at the corners. Rendered
 * on demand through ImageResponse, so there are no binary PNGs to keep in sync.
 */
export function renderIcon(size: number) {
  return new ImageResponse(
    (
      <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8b5cf6" />
            <stop offset=".5" stopColor="#3b82f6" />
            <stop offset="1" stopColor="#2dd4bf" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" fill="url(#g)" />
        <path d="M32 13 54 50H10Z" fill="#0a0a14" />
        <path d="M32 27 41 50H23Z" fill="url(#g)" />
      </svg>
    ),
    { width: size, height: size },
  );
}

/**
 * The status-bar badge Android draws next to a notification.
 *
 * Android keeps only the alpha channel of this image and tints the result, so
 * it has to be a flat silhouette on transparency — the full-colour icon comes
 * out as a solid grey square. iOS and desktop ignore it entirely.
 */
export function renderBadge(size = 96) {
  return new ImageResponse(
    (
      <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
        {/* Just the tent outline: at 24dp in a status bar the doorway
            would not survive the downscale anyway. */}
        <path d="M32 9 58 55H6Z" fill="#ffffff" />
      </svg>
    ),
    { width: size, height: size },
  );
}
