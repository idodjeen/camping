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
