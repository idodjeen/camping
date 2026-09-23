import { deleteComment } from "@/lib/comments";
import { handle, HttpError, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const me = await requireUser();
    const id = Number((await params).id);
    if (!Number.isInteger(id)) throw new HttpError(400, "מזהה לא תקין");
    return deleteComment(me.id, me.isAdmin, id);
  });
}
