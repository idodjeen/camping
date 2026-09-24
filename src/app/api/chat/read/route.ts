import { markGeneralRead } from "@/lib/comments";
import { handle, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Opening the chat tab clears my own unread tags in the general chat. */
export function POST() {
  return handle(async () => {
    const me = await requireUser();
    return markGeneralRead(me.id);
  });
}
