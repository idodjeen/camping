/**
 * Access control list, parsed from the ALLOWED_USERS env var.
 *
 *   ALLOWED_USERS="a@x.com:עידו,b@x.com:ניר,c@x.com:סער"
 *
 * This module is imported by `auth.config.ts`, which middleware loads into the
 * Edge runtime — so it must stay dependency-free and must never touch the DB.
 */

export type AllowedUser = { email: string; name: string };

export function parseAllowlist(raw = process.env.ALLOWED_USERS): AllowedUser[] {
  return parseList(raw);
}

/**
 * Read-only guests, from VIEWER_USERS (same "email:name" format). They can sign
 * in and look at everything but never write, and get no row in `users`.
 */
export function parseViewers(raw = process.env.VIEWER_USERS): AllowedUser[] {
  return parseList(raw);
}

function parseList(raw: string | undefined): AllowedUser[] {
  if (!raw) return [];

  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      // Emails cannot contain ":", so the first colon is always the separator.
      const sep = entry.indexOf(":");
      if (sep === -1) return { email: entry.toLowerCase(), name: entry };
      return {
        email: entry.slice(0, sep).trim().toLowerCase(),
        name: entry.slice(sep + 1).trim(),
      };
    })
    .filter((u) => u.email.includes("@"));
}

export function isAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const target = email.toLowerCase();
  return parseAllowlist().some((u) => u.email === target);
}

export function displayNameFor(email: string | null | undefined): string | null {
  if (!email) return null;
  const target = email.toLowerCase();
  return parseAllowlist().find((u) => u.email === target)?.name ?? null;
}

export function isViewer(email: string | null | undefined): boolean {
  if (!email) return false;
  const target = email.toLowerCase();
  // A full member who is also listed as a viewer stays a member.
  return !isAllowed(target) && parseViewers().some((u) => u.email === target);
}

export function viewerNameFor(email: string | null | undefined): string | null {
  if (!email) return null;
  const target = email.toLowerCase();
  return parseViewers().find((u) => u.email === target)?.name ?? null;
}
