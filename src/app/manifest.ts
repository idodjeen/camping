import type { MetadataRoute } from "next";

import { THEME_COLOR } from "@/lib/theme";

/**
 * Web Push on iOS only works for a site that has been added to the Home Screen
 * and opens as its own app, which is what `display: "standalone"` from this
 * manifest asks for. In a normal Safari tab, `PushManager` does not exist.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "מחנאות",
    short_name: "מחנאות",
    description: "מתכננים טיול עם החברים: מי מביא מה, מה קונים, מה אוכלים ומי חייב למי.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    dir: "rtl",
    lang: "he",
    // The splash screen and the first frame, before the theme script runs.
    background_color: THEME_COLOR.light,
    theme_color: THEME_COLOR.light,
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png" },
    ],
  };
}
