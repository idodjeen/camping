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

  /**
   * Auth.js refuses to build callback URLs from an untrusted Host header, to
   * stop host-header injection redirecting an OAuth code to an attacker.
   * Behind Vercel's proxy every request arrives with a forwarded host, so
   * without this the deployed app fails every auth route with `UntrustedHost`.
   *
   * Set here rather than via AUTH_TRUST_HOST so it cannot be lost to an
   * environment-variable mistake. Safe because the only hosts that can reach
   * this app are the Vercel domains we control, and Google separately rejects
   * any redirect_uri not on its registered list.
   */
  trustHost: true,
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
