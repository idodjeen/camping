import { setPrefs, type NotifyPrefs } from "@/lib/notifications";
import { handle, requireSignedIn } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Which notifications I want. Only ever my own row, chosen by the session. */
export function PATCH(req: Request) {
  return handle(async () => {
    const me = await requireSignedIn();
    const body = (await req.json()) as Partial<NotifyPrefs>;
    return { notify: await setPrefs(me.id, body) };
  });
}
