export const dynamic = "force-dynamic";

/**
 * Deployment diagnostics.
 *
 * Reports which commit is actually serving and which environment variables
 * reach the runtime. Reports only *presence* as booleans — never a value — so
 * it is safe on a public deployment. Without this, "is the fix deployed?" and
 * "did that env var arrive?" can only be guessed at from the outside.
 */
export function GET() {
  const allowed = process.env.ALLOWED_USERS ?? "";

  return Response.json({
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    env: process.env.VERCEL_ENV ?? "local",
    host: process.env.VERCEL_URL ?? null,
    env_present: {
      AUTH_SECRET: Boolean(process.env.AUTH_SECRET),
      AUTH_GOOGLE_ID: Boolean(process.env.AUTH_GOOGLE_ID),
      AUTH_GOOGLE_SECRET: Boolean(process.env.AUTH_GOOGLE_SECRET),
      AUTH_TRUST_HOST: Boolean(process.env.AUTH_TRUST_HOST),
      DATABASE_URL: Boolean(process.env.DATABASE_URL),
      ALLOWED_USERS: Boolean(allowed),
    },
    // Shape checks only — no values. Catches a client ID pasted into the
    // secret field, or an allowlist that parses to zero usable entries.
    google_id_looks_right: process.env.AUTH_GOOGLE_ID?.endsWith(".apps.googleusercontent.com") ?? false,
    google_secret_looks_right: process.env.AUTH_GOOGLE_SECRET?.startsWith("GOCSPX-") ?? false,
    allowed_users_parsed: allowed
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e.slice(0, e.indexOf(":") === -1 ? undefined : e.indexOf(":")).includes("@")).length,
  });
}
