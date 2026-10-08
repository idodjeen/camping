import { groupRoute, type GroupParams } from "@/lib/access";
import { addMembers, parseNewMembers } from "@/lib/group-admin";
import { sendInvites } from "@/lib/invite-email";
import { handle } from "@/lib/session";

export const dynamic = "force-dynamic";
// One SMTP handshake per person added.
export const maxDuration = 60;

/** Adds a pasted list of people as editors or viewers, and emails each one an invite. */
export function POST(req: Request, ctx: GroupParams) {
  return handle(async () => {
    const { group, user: me } = await groupRoute(ctx);
    const input = parseNewMembers(await req.json().catch(() => null));
    // After the transaction has committed: they're in the group whether or not the email goes out.
    const { people, ...result } = await addMembers(group.id, input, me.id);
    return { ...result, invite: await sendInvites(group.name, me, people) };
  });
}
