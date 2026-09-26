import { headers } from "next/headers";

export const dynamic = "force-dynamic";

/**
 * What is deployed right now, for the "what's new" pop-up.
 *
 * Unlike /api/version this returns the commit message, so it stays behind the
 * proxy's auth gate rather than being public. `headers()` forces per-request
 * evaluation for the same reason as in /api/version.
 */
export async function GET() {
  await headers();

  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local";
  const lines = (process.env.VERCEL_GIT_COMMIT_MESSAGE ?? "")
    .split("\n")
    .map((l) => l.trim())
    // Commit trailers are noise to campers.
    .filter((l) => !/^co-authored-by:/i.test(l));

  const [title = "", ...rest] = lines;
  const body = rest.join("\n").trim();

  return Response.json({
    sha,
    title,
    body,
    // Opt-out for commits nobody needs to hear about (typos, config).
    silent: /\[no-popup\]/i.test(title + body),
  });
}
