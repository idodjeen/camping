import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";

import * as schema from "./schema";

/**
 * We use the Pool (WebSocket) driver rather than the lighter neon-http driver
 * because the gear-claim endpoint needs a real interactive transaction:
 * two people claiming the last gas stove at the same moment must not both win.
 * neon-http cannot do `SELECT ... FOR UPDATE` inside a transaction; this can.
 *
 * Node 22+ provides a global WebSocket, so no `ws` polyfill is needed.
 */

// Serverless functions are recycled constantly; caching on globalThis keeps warm
// invocations from opening a fresh connection every time, and stops dev-server
// hot reloads from leaking a new pool on every file save.
const globalForDb = globalThis as unknown as {
  __campingDb?: NeonDatabase<typeof schema>;
};

function connect(): NeonDatabase<typeof schema> {
  if (globalForDb.__campingDb) return globalForDb.__campingDb;

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

  const instance = drizzle(new Pool({ connectionString }), { schema });
  globalForDb.__campingDb = instance;
  return instance;
}

/**
 * The connection is opened lazily, on first query.
 *
 * Doing the DATABASE_URL check at module scope would throw during `next build`,
 * because Next loads every route's module graph to collect its config — even
 * though no query runs at build time. That turns a missing env var into an
 * opaque "Failed to collect page data" build failure. Deferring it means the
 * module imports cleanly and a misconfigured deploy reports the real problem,
 * at request time, with the message above.
 */
export const db = new Proxy({} as NeonDatabase<typeof schema>, {
  get(_target, prop) {
    const real = connect() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export { schema };
