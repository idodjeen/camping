import NextAuth from "next-auth";

import { authConfig } from "./auth.config";

// Note: `authConfig`, not the full `auth.ts`. The proxy runs on the Edge
// runtime, which cannot load the Neon driver.
export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    // Everything except Next internals, the auth endpoints, and static assets.
    "/((?!api/auth|api/version|_next/static|_next/image|avatars|favicon.ico|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
