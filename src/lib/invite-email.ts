import { APP_URL, wrap } from "@/lib/emails";
import { sendAll, type Outgoing } from "@/lib/mailer";

/** Someone just added to a group, under the name they have there. */
export type Invitee = { userId: number; email: string; name: string };

/** How many of the invite emails actually went out. */
export type InviteResult = { sent: number; total: number };

/**
 * One fixed message per person. Nothing in it comes from the request except
 * names and the group's name, all escaped by wrap(), so a group admin can't
 * use this to send arbitrary mail from Ido's Gmail. The link is always
 * APP_URL, never the request's host: previews can't email anyway, and a
 * header must not decide where a real inbox's link points.
 */
export function buildInviteEmails(groupName: string, by: string, people: Invitee[]): Outgoing[] {
  const subject = `הצטרפת לקבוצה "${groupName}" 🏕️`;
  return people.map((p) => {
    const text = [
      `היי ${p.name},`,
      "",
      `${by} הוסיף/ה אותך לקבוצה "${groupName}" באפליקציית הטיולים שלנו.`,
      "",
      `מתחברים עם חשבון הגוגל של ${p.email}.`,
      "באייפון: שיתוף ← הוספה למסך הבית, ואז זה עובד כמו אפליקציה.",
    ].join("\n");
    return { to: p.email, subject, text: `${text}\n\n${APP_URL}`, html: wrap(subject, text) };
  });
}

/**
 * Emails everyone just added, except whoever added them. Never throws: the
 * people are already in the group, and a missing GMAIL_APP_PASSWORD (every
 * preview) or an SMTP timeout must not turn a successful add into an error.
 * The caller reports the count, so the screen only claims what was sent.
 */
export async function sendInvites(
  groupName: string,
  by: { id: number; name: string },
  people: Invitee[],
): Promise<InviteResult> {
  const to = people.filter((p) => p.userId !== by.id);
  if (to.length === 0) return { sent: 0, total: 0 };

  try {
    const results = await sendAll(buildInviteEmails(groupName, by.name, to));
    for (const r of results) if (!r.ok) console.error("invite email failed", r.error);
    return { sent: results.filter((r) => r.ok).length, total: to.length };
  } catch (err) {
    console.error("invite email failed", err);
    return { sent: 0, total: to.length };
  }
}
