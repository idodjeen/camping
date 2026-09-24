import { listMentions, markAllMentionsRead } from "@/lib/comments";
import { handle, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * My notification feed: every comment that tagged me, newest first.
 *
 * There is no user id in the request anywhere — the session decides whose
 * mentions these are, exactly like /api/me. Asking for someone else's feed is
 * not a permission check that can be got wrong, it is unexpressible.
 */
export function GET() {
  return handle(async () => {
    const me = await requireUser();
    return { mentions: await listMentions(me.id) };
  });
}

/** "Mark everything read" from the pane. Only ever my own rows. */
export function POST() {
  return handle(async () => {
    const me = await requireUser();
    return markAllMentionsRead(me.id);
  });
}
