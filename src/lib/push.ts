import { eq, inArray } from "drizzle-orm";
import webpush, { type PushSubscription } from "web-push";

import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";

/**
 * Web Push over VAPID — the same protocol Apple documents for Home Screen web
 * apps (iOS/iPadOS 16.4+). Apple's push service accepts standard VAPID-signed
 * requests, so there is nothing APNs-specific to configure: no certificates,
 * no team id. The key pair *is* the identity.
 *
 * ⚠️ As with the Gmail credentials, these three variables must be **Config**
 * typed on Vercel — Secret-typed ones never reach the runtime on this project.
 */
export type PushPayload = {
  title: string;
  body: string;
  /** Where a tap should land, relative to the app origin. */
  url?: string;
  /** Same tag replaces an earlier notification instead of stacking. */
  tag?: string;
};

export function getPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

let configured = false;
function configure(): boolean {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  // Must be a mailto: or https: URL; the push service uses it to reach us if we misbehave.
  const subject = process.env.VAPID_SUBJECT ?? "mailto:idodwek@gmail.com";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

export async function saveSubscription(userId: number, sub: PushSubscription) {
  const keys = sub.keys;
  if (!sub.endpoint || !keys?.p256dh || !keys?.auth) return false;

  // Keyed on the endpoint: if this device was last used by someone else, it
  // now belongs to whoever is signed in — pushes must follow the current user.
  await db
    .insert(pushSubscriptions)
    .values({ userId, endpoint: sub.endpoint, p256dh: keys.p256dh, auth: keys.auth })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId, p256dh: keys.p256dh, auth: keys.auth },
    });
  return true;
}

export async function removeSubscription(userId: number, endpoint: string) {
  const rows = await db
    .select({ id: pushSubscriptions.id, userId: pushSubscriptions.userId })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint));
  // Only ever my own device; someone else's endpoint is silently a no-op.
  if (rows.some((r) => r.userId === userId)) {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  }
}

/**
 * Best-effort fan-out to every device of the given people. Never throws: push
 * is a courtesy on top of the bell row, and must not fail the action that
 * triggered it. Dead subscriptions (410 Gone / 404) are pruned as we find them.
 */
export async function sendPush(userIds: number[], payload: PushPayload) {
  if (userIds.length === 0 || !configure()) return;

  try {
    const subs = await db
      .select()
      .from(pushSubscriptions)
      .where(inArray(pushSubscriptions.userId, userIds));

    const body = JSON.stringify(payload);
    const gone: string[] = [];

    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body,
            { TTL: 60 * 60 * 24, urgency: "normal" },
          );
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) gone.push(s.endpoint);
          else console.error("push failed", status, (err as Error).message);
        }
      }),
    );

    if (gone.length > 0) {
      await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.endpoint, gone));
    }
  } catch (err) {
    console.error("push fan-out failed", err);
  }
}
