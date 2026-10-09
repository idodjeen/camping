import { and, eq, ne } from "drizzle-orm";

import { db } from "@/db";
import { groupMembers } from "@/db/schema";
import { setPrefs } from "@/lib/notifications";
import { handle, HttpError, requireSignedIn } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Which notifications I want: `{ mentions?, chat?, lists?, money? }`, and the
 * old `messages` / `covered` keys for one release. Only ever my own row,
 * chosen by the session.
 *
 * The switches are per person, not per trip, so "viewer" here means a viewer
 * everywhere: someone who is an editor or admin in any group has bells to
 * configure. A viewer gets no notifications at all, so 403.
 */
export function PATCH(req: Request) {
  return handle(async () => {
    const me = await requireSignedIn();
    if (!me.isSuperAdmin) {
      const [writer] = await db
        .select({ groupId: groupMembers.groupId })
        .from(groupMembers)
        .where(and(eq(groupMembers.userId, me.id), ne(groupMembers.role, "viewer")))
        .limit(1);
      if (!writer) throw new HttpError(403, "מצב צפייה בלבד");
    }
    return { notify: await setPrefs(me.id, await req.json().catch(() => null)) };
  });
}
