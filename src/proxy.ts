import NextAuth from "next-auth";

import { authConfig } from "./auth.config";

// Note: `authConfig`, not the full `auth.ts`: the proxy runs on every request,
// so it only checks that a session exists and never queries the database.
export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    // Everything except Next internals, the auth endpoints, static assets,
    // and Vercel's own /_vercel paths (Speed Insights' script and beacons).
    "/((?!api/auth|_next/static|_next/image|_vercel|avatars|favicon.ico|manifest.webmanifest|sw.js|pwa-icon|apple-icon|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
