/**
 * `npm run db:migrate`: applies ./drizzle to DATABASE_URL, and refuses the
 * production database unless CONFIRM_PROD=1.
 *
 * Production is recognised by host: PROD_DB_HOST, which lives only in
 * .env.local. Without it the script can't tell production from dev, so it
 * refuses everything rather than guess.
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
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";

config({ path: ".env.local" });
config({ path: ".env" });

function fail(message) {
  console.error(`db:migrate: ${message}`);
  process.exit(1);
}

// Neon gives each endpoint two hostnames, direct and pooled
// (ep-x.region... and ep-x-pooler.region...). Both are the same database.
const normalize = (host) => host.trim().toLowerCase().replace(/-pooler(?=\.)/, "");

const url = process.env.DATABASE_URL;
if (!url) fail("DATABASE_URL is missing. Run `vercel env pull .env.local` (see README).");

let host;
try {
  host = normalize(new URL(url).hostname);
} catch {
  fail("DATABASE_URL isn't a valid URL.");
}
if (!host) fail("DATABASE_URL has no host.");

const prodHost = process.env.PROD_DB_HOST;
if (!prodHost) {
  fail("PROD_DB_HOST is missing, so production can't be told apart. Add it to .env.local (see .env.example).");
}

const isProd = host === normalize(prodHost);
if (isProd && process.env.CONFIRM_PROD !== "1") {
  fail(`${host} is the PRODUCTION database. Re-run with CONFIRM_PROD=1 if that's what you meant.`);
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
