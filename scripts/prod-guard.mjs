/**
 * The production check shared by every script that writes to DATABASE_URL:
 * db:migrate, db:seed and db:reset. Each refuses the production database
 * unless CONFIRM_PROD=1.
 *
 * Production is recognised by host: PROD_DB_HOST, which lives only in
 * .env.local. Without it a script can't tell production from dev, so it
 * refuses everything rather than guess.
 *
 * Two ways in:
 *   - import { guardProd } and call it first (scripts/db-migrate.mjs)
 *   - run it ahead of a command that can't import it, in package.json:
 *       node scripts/prod-guard.mjs db:seed && tsx src/db/seed.ts
 *     It exits 1 on refusal, so the `&&` never reaches the command.
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

// Neon gives each endpoint two hostnames, direct and pooled
// (ep-x.region... and ep-x-pooler.region...). Both are the same database.
const normalize = (host) => host.trim().toLowerCase().replace(/-pooler(?=\.)/, "");

/**
 * Loads .env.local and .env, then exits the process with a message prefixed
 * by `label` unless DATABASE_URL is safe to write to. Returns the URL, its
 * normalized host, and whether that host is production (only possible with
 * CONFIRM_PROD=1).
 */
export function guardProd(label) {
  config({ path: ".env.local" });
  config({ path: ".env" });

  const fail = (message) => {
    console.error(`${label}: ${message}`);
    process.exit(1);
  };

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

  return { url, host, isProd };
}

// `node scripts/prod-guard.mjs <label>`: check, announce the target, exit 0.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const label = process.argv[2] ?? "prod-guard";
  const { host, isProd } = guardProd(label);
  console.log(`${label}: target ${host}${isProd ? " (PRODUCTION)" : ""}`);
}
