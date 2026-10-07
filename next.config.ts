import type { NextConfig } from "next";

// The commit this build came from, with the same formula as /api/release.
// Inlined into the bundle so the reload guard (src/lib/reload-guard.ts) can
// tell when an open tab is older than the deploy serving it.
const buildSha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "local";

const nextConfig: NextConfig = {
  env: { BUILD_SHA: buildSha },
  typedRoutes: true,
  // Unique per Vercel deployment (unset locally). Client navigations send it,
  // and when the server's differs Next does a full page load instead, so a
  // tab left open across a deploy picks up the new code on its next move.
  deploymentId: process.env.VERCEL_DEPLOYMENT_ID,
  // The Neon driver opens a real WebSocket; leaving it unbundled avoids the
  // optional-native-dep resolution warnings its bundled form produces.
  serverExternalPackages: ["@neondatabase/serverless"],
  async headers() {
    return [
      {
        // A stale service worker would keep running old push handling
        // indefinitely, so browsers must always revalidate this one file.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
