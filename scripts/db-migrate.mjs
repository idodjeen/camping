/**
 * `npm run db:migrate`: applies ./drizzle to DATABASE_URL, and refuses the
 * production database unless CONFIRM_PROD=1.
 *
 * The check itself lives in scripts/prod-guard.mjs, shared with db:push,
 * db:seed and db:reset.
 *
 * Uses drizzle-orm's neon-serverless migrator, not `drizzle-kit migrate`,
 * which exits silently over its websocket. Same journal and the same
 * drizzle.__drizzle_migrations table, so the two are interchangeable.
 *
 * Production, on purpose:
 *   CONFIRM_PROD=1 DATABASE_URL="<prod url>" npm run db:migrate
 * dotenv never overrides a variable that's already set, so the explicit URL
 * wins over .env.local.
 */
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";

import { guardProd } from "./prod-guard.mjs";

const { url, host, isProd } = guardProd("db:migrate");

function fail(message) {
  console.error(`db:migrate: ${message}`);
  process.exit(1);
}

if (typeof globalThis.WebSocket === "undefined") fail("No global WebSocket. Use Node 22+.");
neonConfig.webSocketConstructor = globalThis.WebSocket;

console.log(`db:migrate: applying ./drizzle to ${host}${isProd ? " (PRODUCTION)" : ""}`);

const pool = new Pool({ connectionString: url });
try {
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  console.log("db:migrate: done");
} catch (err) {
  console.error("db:migrate: failed:", err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
