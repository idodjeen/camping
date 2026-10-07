import { createGroup, listGroups, parseNewGroup } from "@/lib/groups";
import { handle, requireSuperAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Every group and its people. Super admin only; everyone else gets 403. */
export function GET() {
  return handle(async () => {
    await requireSuperAdmin();
    return { groups: await listGroups() };
  });
}

/** A new group with its admin, editors and viewers. Super admin only. */
export function POST(req: Request) {
  return handle(async () => {
    const me = await requireSuperAdmin();
    const input = parseNewGroup(await req.json().catch(() => null));
    return createGroup(input, me.id);
  });
}
