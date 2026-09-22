import { getShopping } from "@/lib/queries";
import { handle, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(async () => {
    const me = await requireUser();
    // canBuy drives whether the client renders checkboxes. The PATCH handler
    // re-checks it server-side — this is presentation only, never permission.
    return { categories: await getShopping(), canBuy: me.isShopper };
  });
}
