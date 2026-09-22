import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// `dotenv/config` only reads .env; Vercel writes .env.local. Load both,
// local first, so `vercel env pull` output is picked up without extra steps.
config({ path: ".env.local" });
config({ path: ".env" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing. Run `vercel env pull .env.local` first.");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL },
  strict: true,
  verbose: true,
});
