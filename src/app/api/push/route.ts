import type { PushSubscription } from "web-push";

import { getPublicKey, removeSubscription, saveSubscription, sendPushLater } from "@/lib/push";
import { handle, HttpError, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** The public VAPID key the browser needs to subscribe. Not a secret. */
export function GET() {
  return handle(async () => {
    await requireUser();
    return { publicKey: getPublicKey() };
  });
}

/** Register this device for my pushes. The user comes from the session, never the body. */
export function POST(req: Request) {
  return handle(async () => {
    const me = await requireUser();
    const { subscription, test, replaces } = (await req.json()) as {
      subscription?: PushSubscription;
      test?: boolean;
      /** The endpoint this one supersedes, sent by the SW on a rotation. */
      replaces?: string;
    };
    if (!subscription || !(await saveSubscription(me.id, subscription))) {
      throw new HttpError(400, "מינוי לא תקין");
    }
    // Drop the retired row now rather than leaving it to be pruned by the next
    // push that fails against it.
    if (replaces && replaces !== subscription.endpoint) {
      await removeSubscription(me.id, replaces);
    }
    // Confirms the whole pipe works right after opting in — to me only.
    if (test) {
      sendPushLater([me.id], {
        title: "ההתראות פעילות ✅",
        body: "מעכשיו נעדכן אותך על הודעות, תיוגים וציוד.",
        url: "/me",
        tag: "welcome",
      });
    }
    return { ok: true };
  });
}

export function DELETE(req: Request) {
  return handle(async () => {
    const me = await requireUser();
    const { endpoint } = (await req.json()) as { endpoint?: string };
    if (!endpoint) throw new HttpError(400, "חסר endpoint");
    await removeSubscription(me.id, endpoint);
    return { ok: true };
  });
}
