/**
 * Where lib/tap-timer.ts sends one line per tap: how long the screen and its
 * content took to show. It only logs, so the numbers can be read from the
 * Vercel logs (`grep tap-timing`). Paths arrive without ids and nothing about
 * the person is kept; the proxy has already checked there is a session.
 */

const KINDS = new Set(["tab", "menu", "chip"]);

const ms = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 60_000 ? Math.round(v) : null);
const path = (v: unknown) => (typeof v === "string" && /^\/[\w/:?=&.-]{0,100}$/.test(v) ? v : null);

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    // sendBeacon posts text/plain.
    body = JSON.parse(await req.text());
  } catch {
    return new Response(null, { status: 400 });
  }

  const line = {
    to: path(body.to),
    from: path(body.from),
    kind: KINDS.has(body.kind as string) ? body.kind : "other",
    commitMs: ms(body.commitMs),
    contentMs: ms(body.contentMs),
    standalone: body.standalone === true,
  };
  if (!line.to || line.commitMs === null) return new Response(null, { status: 400 });

  console.info("tap-timing", JSON.stringify(line));
  return new Response(null, { status: 204 });
}
