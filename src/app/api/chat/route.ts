import { listChat } from "@/lib/comments";
import { handle, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** The whole crew's comments as one timeline. The viewer only shapes the tag/unread flags. */
export function GET() {
  return handle(async () => {
    const me = await requireUser();
    return { messages: await listChat(me.id) };
  });
}
