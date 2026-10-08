import { createGroup, listGroups, parseNewGroup } from "@/lib/groups";
import { sendInvites } from "@/lib/invite-email";
import { handle, requireSuperAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";
// One SMTP handshake per person in the new group.
export const maxDuration = 60;

/** Every group and its people. Super admin only; everyone else gets 403. */
export function GET() {
  return handle(async () => {
    await requireSuperAdmin();
    return { groups: await listGroups() };
  });
}

/** A new group with its admin, editors and viewers, each emailed an invite. Super admin only. */
export function POST(req: Request) {
  return handle(async () => {
    const me = await requireSuperAdmin();
    const input = parseNewGroup(await req.json().catch(() => null));
    // After the transaction has committed: the group exists whether or not the emails go out.
    const { people, ...result } = await createGroup(input, me.id);
    return { ...result, invite: await sendInvites(result.group.name, me, people) };
  });
}
