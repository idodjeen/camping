import NextAuth from "next-auth";

import { authConfig } from "./auth.config";
import { canSignIn, findUserByEmail } from "@/lib/user";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,

    /**
     * The gate. Returning false sends the person to `pages.error` (/no-access)
     * instead of creating a session. It reads `group_members`, so adding
     * someone to a group in the app is all it takes to let them in.
     */
    async signIn({ user, profile }) {
      const email = profile?.email ?? user?.email;
      return email ? canSignIn(email) : false;
    },

    /**
     * On sign-in only, stash the user's id on the token.
     *
     * Deliberately only the id, not any role. Roles are per group and re-read
     * from the database on every request (see lib/access.ts), so a change takes
     * effect immediately instead of waiting for a 30-day JWT to expire.
     */
    async jwt({ token, user }) {
      if (user?.email) {
        const row = await findUserByEmail(user.email);
        if (row) token.uid = row.id;
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
