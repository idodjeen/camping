import * as adminNotify from "../t/[tripId]/admin/notify/route";
import * as chat from "../t/[tripId]/chat/route";
import * as chatRead from "../t/[tripId]/chat/read/route";
import * as comments from "../t/[tripId]/comments/route";
import * as commentById from "../t/[tripId]/comments/[id]/route";
import * as commentsRead from "../t/[tripId]/comments/read/route";
import * as dashboard from "../t/[tripId]/dashboard/route";
import * as expenses from "../t/[tripId]/expenses/route";
import * as expenseById from "../t/[tripId]/expenses/[id]/route";
import * as gear from "../t/[tripId]/gear/route";
import * as gearClaim from "../t/[tripId]/gear/[id]/claim/route";
import * as leaderboard from "../t/[tripId]/leaderboard/route";
import * as me from "../t/[tripId]/me/route";
import * as meals from "../t/[tripId]/meals/route";
import * as notifications from "../t/[tripId]/notifications/route";
import * as personal from "../t/[tripId]/personal/route";
import * as personalById from "../t/[tripId]/personal/[id]/route";
import * as settlements from "../t/[tripId]/settlements/route";
import * as settlementById from "../t/[tripId]/settlements/[id]/route";
import * as shopping from "../t/[tripId]/shopping/route";
import * as shoppingById from "../t/[tripId]/shopping/[id]/route";
import * as weather from "../t/[tripId]/weather/route";
import { getCurrentUser } from "@/lib/session";
import { homeTripId } from "@/lib/trips";

/**
 * TEMPORARY: the pre-trip API paths (/api/gear, /api/me, ...) for one release.
 *
 * A phone that had the app open during the deploy keeps running the old
 * bundle, which still calls these. Each one runs the real handler under
 * /api/t/[tripId] for the caller's home trip (the last one they opened), so
 * every access check is the same code. Delete this file in the cleanup PR
 * (H in docs/roadmap.md).
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Method = "GET" | "POST" | "PATCH" | "DELETE";
type Handler = (
  req: Request,
  ctx: { params: Promise<Record<string, string>> },
) => Response | Promise<Response>;

const ROUTES: Record<string, Partial<Record<Method, unknown>>> = {
  "admin/notify": adminNotify,
  chat,
  "chat/read": chatRead,
  comments,
  "comments/read": commentsRead,
  "comments/:id": commentById,
  dashboard,
  expenses,
  "expenses/:id": expenseById,
  gear,
  "gear/:id/claim": gearClaim,
  leaderboard,
  me,
  meals,
  notifications,
  personal,
  "personal/:id": personalById,
  settlements,
  "settlements/:id": settlementById,
  shopping,
  "shopping/:id": shoppingById,
  weather,
};

function match(path: string[]): { handlers: Partial<Record<Method, unknown>>; id?: string } | null {
  for (const [pattern, handlers] of Object.entries(ROUTES)) {
    const parts = pattern.split("/");
    if (parts.length !== path.length) continue;
    let id: string | undefined;
    const ok = parts.every((p, i) => {
      if (p !== ":id") return p === path[i];
      id = path[i];
      return /^\d+$/.test(path[i]);
    });
    if (ok) return { handlers, id };
  }
  return null;
}

function json(status: number, error: string) {
  return Response.json({ error }, { status });
}

async function forward(method: Method, req: Request, ctx: { params: Promise<{ legacy: string[] }> }) {
  const found = match((await ctx.params).legacy);
  const handler = found?.handlers[method] as Handler | undefined;
  if (!handler) return json(404, "לא נמצא");

  const user = await getCurrentUser();
  if (!user) return json(401, "לא מחובר");
  const tripId = await homeTripId(user);
  if (!tripId) return json(404, "הטיול לא נמצא");

  const params: Record<string, string> = { tripId: String(tripId) };
  if (found!.id) params.id = found!.id;
  return handler(req, { params: Promise.resolve(params) });
}

export const GET = (req: Request, ctx: { params: Promise<{ legacy: string[] }> }) => forward("GET", req, ctx);
export const POST = (req: Request, ctx: { params: Promise<{ legacy: string[] }> }) => forward("POST", req, ctx);
export const PATCH = (req: Request, ctx: { params: Promise<{ legacy: string[] }> }) => forward("PATCH", req, ctx);
export const DELETE = (req: Request, ctx: { params: Promise<{ legacy: string[] }> }) => forward("DELETE", req, ctx);
