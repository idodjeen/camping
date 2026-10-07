import NextAuth from "next-auth";

import { authConfig } from "./auth.config";

// Note: `authConfig`, not the full `auth.ts`: the proxy runs on every request,
// so it only checks that a session exists and never queries the database.
export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    // Everything except Next internals, the auth endpoints, and static assets.
    "/((?!api/auth|_next/static|_next/image|avatars|favicon.ico|manifest.webmanifest|sw.js|pwa-icon|apple-icon|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
