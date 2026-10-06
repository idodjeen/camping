import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
