import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

import { isAllowed } from "@/lib/allowlist";

/**
 * EDGE-SAFE auth config.
 *
 * `middleware.ts` loads this into the Edge runtime, so nothing here may import
 * the database, `node:` builtins, or anything that pulls them in transitively.
 * The DB-aware half of the config lives in `src/auth.ts`, which only ever runs
 * in Node route handlers. Mixing the two is the classic Auth.js v5 build break.
 */
export const authConfig = {
  providers: [Google],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/no-access",
  },
  callbacks: {
    /**
     * The allowlist gate. Returning false sends the user to `pages.error`
     * (/no-access) instead of creating a session.
     */
    signIn({ user, profile }) {
      return isAllowed(profile?.email ?? user?.email);
    },

    /** Route protection for middleware. */
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      if (pathname === "/login" || pathname === "/no-access") return true;
      return Boolean(auth?.user);
    },
  },
} satisfies NextAuthConfig;
