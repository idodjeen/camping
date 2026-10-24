import { intParam, tripRoute } from "@/lib/access";
import { deleteComment, updateComment } from "@/lib/comments";
import { buildMentionEmails } from "@/lib/emails";
import { sendAll } from "@/lib/mailer";
import { handle } from "@/lib/session";

export const dynamic = "force-dynamic";
// Newly tagged people are emailed: several SMTP handshakes.
export const maxDuration = 60;

type Ctx = { params: Promise<{ tripId: string; id: string }> };

/**
 * Edit my own message: `{ body }`. Viewers get 403 from the gate, anyone
 * else's message 403 from updateComment, admins included.
 */
export function PATCH(req: Request, ctx: Ctx) {
  return handle(async () => {
    const { trip, user: me } = await tripRoute(ctx, "write");
    const id = intParam((await ctx.params).id);
    const body = (await req.json().catch(() => ({}))) as { body?: unknown };
    const { comment, added, label } = await updateComment(
      trip.id,
      me.id,
      id,
      typeof body.body === "string" ? body.body : "",
    );

    if (added.length > 0) {
      // Best-effort, as when sending: a mail failure must not undo the edit.
      try {
        await sendAll(
          buildMentionEmails(
            trip.id,
            me.name,
            label,
            comment.body,
            added.map((p) => ({ email: p.email, name: p.name })),
          ),
        );
      } catch (err) {
        console.error("mention email failed", err);
      }
    }

    return {
      comment: { id: comment.id, body: comment.body, editedAt: comment.editedAt?.toISOString() ?? null },
      notified: added.map((p) => p.name),
    };
  });
}

export function DELETE(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const { trip, user, isAdmin } = await tripRoute(ctx, "write");
    const id = intParam((await ctx.params).id);
    return deleteComment(trip.id, user.id, isAdmin, id);
  });
}
