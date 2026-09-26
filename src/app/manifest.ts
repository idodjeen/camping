import type { MetadataRoute } from "next";

/**
 * Web Push on iOS only works for a site that has been added to the Home Screen
 * and opens as its own app, which is what `display: "standalone"` from this
 * manifest asks for. In a normal Safari tab, `PushManager` does not exist.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "מחנאות 2026",
    short_name: "מחנאות",
    description: "מי מביא מה, מה אוכלים, ומה עוד צריך לקנות.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    dir: "rtl",
    lang: "he",
    background_color: "#06060c",
    theme_color: "#06060c",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png" },
    ],
  };
}
