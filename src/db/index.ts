import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

import * as schema from "./schema";

/**
 * We use the Pool (WebSocket) driver rather than the lighter neon-http driver
 * because the gear-claim endpoint needs a real interactive transaction:
 * two people claiming the last gas stove at the same moment must not both win.
 * neon-http cannot do `SELECT ... FOR UPDATE` inside a transaction; this can.
 *
 * Node 22+ provides a global WebSocket, so no `ws` polyfill is needed.
 */
if (typeof globalThis.WebSocket === "undefined") {
  throw new Error(
    "No global WebSocket. This app requires Node 22+ (see package.json engines).",
  );
}
neonConfig.webSocketConstructor = globalThis.WebSocket;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is missing. Run `vercel env pull .env.local` (see README).",
  );
}

// Serverless functions are recycled constantly; caching the pool on globalThis
// keeps warm invocations from opening a fresh connection every time, and stops
// dev-server hot reloads from leaking a new pool on every file save.
const globalForDb = globalThis as unknown as { __campingPool?: Pool };

const pool = globalForDb.__campingPool ?? new Pool({ connectionString });
if (process.env.NODE_ENV !== "production") globalForDb.__campingPool = pool;

export const db = drizzle(pool, { schema });
export { schema };
