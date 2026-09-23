import nodemailer, { type Transporter } from "nodemailer";

import { HttpError } from "@/lib/session";

/**
 * Gmail SMTP transport.
 *
 * Uses an app password rather than the account password — Google requires it
 * once 2FA is on, and it is scoped to this one app and revocable instantly
 * without touching the account itself.
 *
 * ⚠️ On this Vercel project both variables must be stored as **Config** type,
 * not Secret: Secret-typed variables never reach the runtime here. That is the
 * failure that cost hours during Phase 1 — a missing value surfaces only as an
 * opaque error at send time.
 */
const globalForMail = globalThis as unknown as { __campingMail?: Transporter };

export function getTransport(): Transporter {
  if (globalForMail.__campingMail) return globalForMail.__campingMail;

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    throw new HttpError(
      500,
      "שליחת מיילים לא מוגדרת — חסרים GMAIL_USER / GMAIL_APP_PASSWORD",
    );
  }

  const t = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
  globalForMail.__campingMail = t;
  return t;
}

export type Outgoing = { to: string; subject: string; text: string; html: string };

export type SendResult = { to: string; ok: boolean; error?: string };

/**
 * Sends sequentially and never throws for an individual failure: one bad
 * address should not silently cancel the other four. The caller reports which
 * recipients actually received the mail.
 */
export async function sendAll(messages: Outgoing[]): Promise<SendResult[]> {
  const transport = getTransport();
  const from = `מחנאות 2026 <${process.env.GMAIL_USER}>`;
  const results: SendResult[] = [];

  for (const m of messages) {
    try {
      await transport.sendMail({ from, to: m.to, subject: m.subject, text: m.text, html: m.html });
      results.push({ to: m.to, ok: true });
    } catch (err) {
      results.push({ to: m.to, ok: false, error: (err as Error).message });
    }
  }
  return results;
}
