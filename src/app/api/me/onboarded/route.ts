import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { handle, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Marks the onboarding cards as seen. Idempotent — re-finishing is harmless. */
export function POST() {
  return handle(async () => {
    const me = await requireUser();
    await db.update(users).set({ onboardedAt: new Date() }).where(eq(users.id, me.id));
    return { ok: true };
  });
}
