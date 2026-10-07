import { EVERYONE } from "@/lib/mention-all";

/**
 * The rules for a person as the admin screens type them in: an email and a
 * display name. Pure and import-free (apart from one constant), so the form
 * checks a pasted list as you type and the API applies the very same rules.
 */

export type PersonInput = { email: string; name: string };

export const NAME_MAX = 20;

const EMAIL = /^[^\s@,;:<>()]+@[^\s@,;:<>()]+\.[^\s@,;:<>()]+$/;

export const isEmail = (s: string) => EMAIL.test(s);

/**
 * Why a display name can't be used, or null when it can.
 *
 * Names are @mention targets: the composer's picker stops at a space, and
 * findMentions() in lib/comments.ts matches "@name" up to the next letter or
 * digit. So no whitespace, and none of the characters the pasted-list format
 * uses as separators. Length counts characters, not UTF-16 units.
 */
export function nameProblem(raw: string): string | null {
  const name = raw.trim();
  const length = [...name].length;
  if (length === 0) return "חסר שם";
  if (length > NAME_MAX) return `שם עד ${NAME_MAX} תווים`;
  if (/\s/u.test(name)) return "שם בלי רווחים (הוא משמש לתיוג עם @)";
  if (/[@,;:<>]/.test(name)) return "שם בלי @ , ; : < >";
  if (name === EVERYONE) return `"${EVERYONE}" שמור לתיוג של כולם`;
  return null;
}

/** Names compare case-insensitively, so "Dana" and "dana" can't share a group. */
export const nameKey = (name: string) => name.trim().toLocaleLowerCase("en");

export type ParsedLine = PersonInput & { line: string; error: string | null };

/**
 * A pasted list, one person per line (or comma separated): an email and a
 * name, in either order, with a space, tab, colon or dash between them.
 *
 *   dana@gmail.com דנה
 *   רון: ron.levi@gmail.com
 *   a@x.com:דנה,b@x.com:רון      (the old VIEWER_USERS format)
 *
 * Every line comes back, each with its own error, so the form can say exactly
 * which line to fix rather than refusing the whole paste.
 */
export function parsePeople(text: string): ParsedLine[] {
  return text
    .split(/[\n,;]+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/[^\s@,;:<>()]+@[^\s@,;:<>()]+/);
      if (!match) return { line, email: "", name: "", error: "לא נמצא מייל בשורה" };
      const email = match[0].toLowerCase();
      // Whatever is left once the email and the separators around it are gone.
      const name = (line.slice(0, match.index) + " " + line.slice(match.index! + match[0].length))
        .replace(/^[\s:\-–]+|[\s:\-–]+$/g, "")
        .trim();
      const error = !isEmail(email) ? "המייל לא תקין" : nameProblem(name);
      return { line, email, name, error };
    });
}

/**
 * The same email twice anywhere in the form, or two people with the same
 * name. Returns one message per clash; empty when the lists are clean.
 */
export function clashes(people: PersonInput[]): string[] {
  const out: string[] = [];
  const emails = new Set<string>();
  const names = new Map<string, string>();
  for (const p of people) {
    if (emails.has(p.email)) out.push(`${p.email} מופיע יותר מפעם אחת`);
    emails.add(p.email);
    const key = nameKey(p.name);
    const other = names.get(key);
    if (other && other !== p.email) out.push(`השם ${p.name} כבר תפוס בקבוצה (${other})`);
    else names.set(key, p.email);
  }
  return out;
}

export const ROLE_LABEL = { admin: "מנהל/ת", editor: "חבר/ה", viewer: "צפייה" } as const;

/**
 * The WhatsApp message for people just added to a group. No email goes out:
 * the admin pastes this into the group chat. It names the Google account
 * because that's the one thing people get wrong (signing in with a work
 * address they weren't added under).
 */
export function inviteMessage(groupName: string, link: string) {
  return [
    `היי! 🏕️ הוספתי אתכם לקבוצה "${groupName}" באפליקציית הטיולים שלנו.`,
    "",
    `נכנסים מכאן: ${link}`,
    "מתחברים עם חשבון הגוגל של המייל שנתתם לי.",
    "",
    "באייפון: שיתוף ← הוספה למסך הבית, ואז זה עובד כמו אפליקציה.",
  ].join("\n");
}
