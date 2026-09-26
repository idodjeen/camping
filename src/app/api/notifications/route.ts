import { listMentions, listNotifications, markAllMentionsRead } from "@/lib/comments";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/notifications";
import { handle, HttpError, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * My bell: the tags that name me, plus the messages and "covered" events I
 * asked to hear about, each newest first. The pane merges them by time.
 *
 * There is no user id in the request anywhere — the session decides whose
 * feed this is, exactly like /api/me. Asking for someone else's is not a
 * permission check that can be got wrong, it is unexpressible.
 */
export function GET() {
  return handle(async () => {
    const me = await requireUser();
    const [mentions, notifications] = await Promise.all([
      listMentions(me.id),
      listNotifications(me.id),
    ]);
    return { mentions, notifications };
  });
}

/** "Mark everything read" from the pane. Only ever my own rows. */
export function POST() {
  return handle(async () => {
    const me = await requireUser();
    const [a, b] = await Promise.all([
      markAllMentionsRead(me.id),
      markAllNotificationsRead(me.id),
    ]);
    return { marked: a.marked + b.marked };
  });
}

/** Opening one bell row marks just that row read. */
export function PATCH(req: Request) {
  return handle(async () => {
    const me = await requireUser();
    const { id } = (await req.json()) as { id?: number };
    if (!Number.isInteger(id)) throw new HttpError(400, "מזהה לא תקין");
    return markNotificationRead(me.id, id!);
  });
}
