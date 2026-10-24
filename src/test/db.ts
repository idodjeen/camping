import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";

import * as schema from "@/db/schema";

const MIGRATIONS = fileURLToPath(new URL("../../drizzle", import.meta.url));

// The same switch the scripts use: `db` in src/db reads this before it would
// ever open a Neon connection, so app code runs unchanged against PGlite.
const g = globalThis as unknown as { __campingDb?: unknown };

let client: PGlite | null = null;

/** A new in-memory Postgres with every migration applied, installed as the app's `db`. */
export async function freshDb() {
  await closeDb();
  client = new PGlite();
  const instance = drizzle(client, { schema });
  await migrate(instance, { migrationsFolder: MIGRATIONS });
  g.__campingDb = instance;
  return instance;
}

export async function closeDb() {
  g.__campingDb = undefined;
  if (client) await client.close();
  client = null;
}
