import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

/**
 * The database-free half of the auth config, which `src/proxy.ts` loads.
 *
 * The proxy runs on every request, so it stays a cheap "is there a session at
 * all?" check. Who may sign in, and what they may see, needs the database and
 * lives in `src/auth.ts` and `src/lib/access.ts`.
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
    /** Route protection for the proxy. */
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      if (pathname === "/login" || pathname === "/no-access") return true;
      return Boolean(auth?.user);
    },
  },
} satisfies NextAuthConfig;
