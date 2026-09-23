import { NOTIFY_TYPES, type NotifyType, buildMessages } from "@/lib/emails";
import { sendAll } from "@/lib/mailer";
import { handle, HttpError, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
// Five sequential SMTP handshakes comfortably exceed the default limit.
export const maxDuration = 60;

function parseType(value: string | null): NotifyType {
  if (!value || !NOTIFY_TYPES.includes(value as NotifyType)) {
    throw new HttpError(400, "סוג תזכורת לא מוכר");
  }
  return value as NotifyType;
}

async function requireAdmin() {
  const me = await requireUser();
  if (!me.isAdmin) throw new HttpError(403, "רק עידו יכול לשלוח תזכורות");
  return me;
}

/** Preview: exactly what would be sent, and to whom. Sends nothing. */
export function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const type = parseType(new URL(req.url).searchParams.get("type"));
    const messages = await buildMessages(type);
    return {
      type,
      count: messages.length,
      messages: messages.map((m) => ({ to: m.to, subject: m.subject, text: m.text })),
    };
  });
}

/**
 * Send.
 *
 * Note what this handler does NOT read: any recipient from the request body.
 * Addresses come only from `buildMessages`, which derives them from the users
 * table. A publicly-reachable route that emails whoever it is told to would be
 * an open relay running off a personal Gmail account.
 */
export function POST(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const body = (await req.json().catch(() => ({}))) as { type?: string };
    const type = parseType(body.type ?? null);

    const messages = await buildMessages(type);
    if (messages.length === 0) return { type, sent: 0, results: [] };

    const results = await sendAll(messages);
    return {
      type,
      sent: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    };
  });
}
