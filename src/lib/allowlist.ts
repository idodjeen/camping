/**
 * The last remnant of the env-var access lists: VIEWER_USERS.
 *
 *   VIEWER_USERS="a@x.com:דנה,b@x.com:רון"
 *
 * Access now lives in `group_members`. VIEWER_USERS is a Vercel "Sensitive"
 * variable that nobody can read back, so instead of copying it into the
 * database by hand, each person on it is imported as a viewer of the original
 * group the first time they sign in (see `importEnvViewer` in lib/user.ts).
 * Delete the variable and `envViewer` in phase 7 of docs/groups-and-trips.md;
 * `parseEmailList` stays for the seed.
 */

export type EnvViewer = { email: string; name: string };

export function envViewer(email: string): EnvViewer | null {
  const target = email.toLowerCase();
  return parseEmailList(process.env.VIEWER_USERS).find((u) => u.email === target) ?? null;
}

/** "email:name,email:name" -> entries. Also used by the seed for ALLOWED_USERS. */
export function parseEmailList(raw: string | undefined): EnvViewer[] {
  if (!raw) return [];

  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      // Emails cannot contain ":", so the first colon is always the separator.
      const sep = entry.indexOf(":");
      if (sep === -1) return { email: entry.toLowerCase(), name: entry.split("@")[0] };
      return {
        email: entry.slice(0, sep).trim().toLowerCase(),
        name: entry.slice(sep + 1).trim(),
      };
    })
    .filter((u) => u.email.includes("@"));
}
