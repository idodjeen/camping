import NextAuth from "next-auth";

import { authConfig } from "./auth.config";
import { getOrCreateUser } from "@/lib/user";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,

    /**
     * On first sign-in only, resolve the Google account to our own user row and
     * stash its id on the token.
     *
     * Deliberately only the id — not the roles. Roles are re-read from the DB on
     * every request (see lib/session.ts) so that changing someone's permissions
     * takes effect immediately instead of waiting for a 30-day JWT to expire.
     */
    async jwt({ token, user }) {
      if (user?.email) {
        const row = await getOrCreateUser(user.email);
        token.uid = row.id;
      }
      return token;
    },

    session({ session, token }) {
      if (session.user && typeof token.uid === "number") {
        session.user.id = String(token.uid);
      }
      return session;
    },
  },
});
