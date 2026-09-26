import { migrate } from "drizzle-orm/neon-serverless/migrator";

import { db } from "./index";

/**
 * Applies ./drizzle through the app's own driver. A fallback for when
 * `drizzle-kit migrate` exits silently over its websocket; same journal,
 * same __drizzle_migrations table, so the two are interchangeable.
 */
migrate(db, { migrationsFolder: "./drizzle" })
  .then(() => {
    console.log("migrations applied");
    process.exit(0);
  })
  .catch((err) => {
    console.error("migration failed:", err);
    process.exit(1);
  });
