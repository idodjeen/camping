import type { PushSubscription } from "web-push";

import { getPublicKey, removeSubscription, saveSubscription, sendPush } from "@/lib/push";
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
    const { subscription, test } = (await req.json()) as {
      subscription?: PushSubscription;
      test?: boolean;
    };
    if (!subscription || !(await saveSubscription(me.id, subscription))) {
      throw new HttpError(400, "מינוי לא תקין");
    }
    // Confirms the whole pipe works right after opting in — to me only.
    if (test) {
      await sendPush([me.id], {
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
