import { eq } from "drizzle-orm";

import { db } from "@/db";
import { gearClaims, trip, users } from "@/db/schema";
import { daysUntil, formatTripDay } from "@/lib/dates";
import { formatGearList, formatMyList, formatShoppingList } from "@/lib/format-lists";
import type { Outgoing } from "@/lib/mailer";
import { getGear, getShopping } from "@/lib/queries";
import { getForecast } from "@/lib/weather";

export const NOTIFY_TYPES = ["unclaimed", "countdown", "packing", "shopping"] as const;
export type NotifyType = (typeof NOTIFY_TYPES)[number];

export const NOTIFY_INFO: Record<NotifyType, { label: string; who: string }> = {
  unclaimed: { label: "ציוד שעוד לא נתפס", who: "לכולם" },
  countdown: { label: "ספירה לאחור + מצב הטיול", who: "לכולם" },
  packing: { label: "תזכורת אריזה אישית", who: "לכל אחד בנפרד" },
  shopping: { label: "קניות שלא נקנו", who: "לעידו וניר" },
};

const APP_URL = process.env.AUTH_URL ?? "https://camping-rosy.vercel.app";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Email clients strip <style> blocks and most modern CSS, so everything is
 * inline and deliberately plain. The body is rendered inside a pre-wrap block
 * because the formatters produce newline-separated plain text — the same text
 * the in-app copy buttons hand to WhatsApp.
 */
function wrap(heading: string, body: string) {
  return `<div dir="rtl" style="background:#0a0a14;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#e7e7f2">
  <div style="max-width:560px;margin:0 auto;background:#11111f;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:24px">
    <h1 style="margin:0 0 16px;font-size:20px;color:#a78bfa">${escapeHtml(heading)}</h1>
    <div style="white-space:pre-wrap;font-size:14px;line-height:1.7;color:#d7d7e6">${escapeHtml(body)}</div>
    <a href="${APP_URL}" style="display:inline-block;margin-top:20px;padding:10px 18px;background:#7c3aed;color:#fff;border-radius:10px;text-decoration:none;font-weight:bold">לפתוח את האפליקציה</a>
  </div>
</div>`;
}

/**
 * Builds the messages for one notification type.
 *
 * Recipients are derived here from the users table — never from a request
 * body. A publicly-reachable route that emails whoever it is told to is an
 * open relay running off a personal Gmail account.
 */
export async function buildMessages(type: NotifyType): Promise<Outgoing[]> {
  const people = await db.select().from(users);
  const [t] = await db.select().from(trip).where(eq(trip.id, 1));
  const tripName = t?.name ?? "מחנאות 2026";

  if (type === "unclaimed") {
    const gear = await getGear();
    const missing = gear
      .flatMap((c) => c.items)
      .filter((i) => !i.isFull && !i.isOptional).length;
    const body = formatGearList(gear, { onlyMissing: true });
    const subject =
      missing === 0 ? `${tripName} — כל הציוד מכוסה 🎉` : `${tripName} — עוד ${missing} פריטי ציוד חסרים`;

    return people.map((u) => ({
      to: u.email,
      subject,
      text: `היי ${u.name},\n\n${body}`,
      html: wrap(subject, `היי ${u.name},\n\n${body}`),
    }));
  }

  if (type === "countdown") {
    const [gear, shopping, forecast] = await Promise.all([getGear(), getShopping(), getForecast()]);
    const required = gear.flatMap((c) => c.items).filter((i) => !i.isOptional);
    const shopItems = shopping.flatMap((c) => c.items);
    const left = t ? daysUntil(t.startDate) : null;

    const parts = [
      left !== null && left > 0 ? `נשארו ${left} ימים 🏕️` : "אנחנו בטיול 🔥",
      "",
      `ציוד מכוסה: ${required.filter((i) => i.isFull).length} מתוך ${required.length}`,
      `קניות: ${shopItems.filter((i) => i.isBought).length} מתוך ${shopItems.length}`,
    ];

    if (forecast.available) {
      parts.push("", "*מזג אוויר*");
      for (const d of forecast.days) {
        parts.push(`${formatTripDay(d.date)} — ${d.max}°/${d.min}° · גשם ${d.rain}% · רוח ${d.wind}`);
      }
    }

    const missing = required.filter((i) => !i.isFull);
    if (missing.length > 0) {
      parts.push("", `*עוד חסר (${missing.length})*`, ...missing.slice(0, 12).map((i) => `⬜ ${i.name}`));
      if (missing.length > 12) parts.push(`ועוד ${missing.length - 12}…`);
    }

    const body = parts.join("\n");
    const subject = left !== null && left > 0 ? `${tripName} — עוד ${left} ימים` : `${tripName} — יוצאים!`;

    return people.map((u) => ({
      to: u.email,
      subject,
      text: `היי ${u.name},\n\n${body}`,
      html: wrap(subject, `היי ${u.name},\n\n${body}`),
    }));
  }

  if (type === "packing") {
    const claims = await db.query.gearClaims.findMany({
      with: { item: { with: { category: true } } },
    });

    // One personalised email each, and only to people who actually have
    // something left to pack. Deliberately excludes personal_items: that list
    // is private to the app and should not be copied into an inbox.
    return people.flatMap((u) => {
      const mine = claims
        .filter((c) => c.userId === u.id && !c.isPacked)
        .map((c) => ({
          name: c.item.name,
          qty: c.qty,
          isPacked: c.isPacked,
          categoryName: c.item.category.name,
        }));
      if (mine.length === 0) return [];

      const body = formatMyList(u.name, mine, [], { onlyUnpacked: true });
      const subject = `${tripName} — נשאר לך לארוז ${mine.length} פריטים`;
      return [{
        to: u.email,
        subject,
        text: `היי ${u.name},\n\n${body}`,
        html: wrap(subject, `היי ${u.name},\n\n${body}`),
      }];
    });
  }

  // shopping — only the people who are allowed to buy
  const shopping = await getShopping();
  const remaining = shopping.flatMap((c) => c.items).filter((i) => !i.isBought).length;
  const body = formatShoppingList(shopping, { onlyRemaining: true });
  const subject = `${tripName} — נשארו ${remaining} פריטים לקנות`;

  return people
    .filter((u) => u.isShopper)
    .map((u) => ({
      to: u.email,
      subject,
      text: `היי ${u.name},\n\n${body}`,
      html: wrap(subject, `היי ${u.name},\n\n${body}`),
    }));
}

/**
 * Sent the moment someone is tagged — not from the admin panel, which is why
 * it is not one of NOTIFY_TYPES. Recipients come from the mention rows the
 * server derived from the message text, never from a request body.
 */
export function buildMentionEmails(
  author: string,
  itemName: string,
  body: string,
  recipients: { email: string; name: string }[],
): Outgoing[] {
  const subject = `${author} שאל אותך על ${itemName}`;
  return recipients.map((r) => {
    const text = `היי ${r.name},\n\n${author} כתב לך על «${itemName}»:\n\n${body}`;
    return { to: r.email, subject, text, html: wrap(subject, text) };
  });
}
