import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  // The Neon driver opens a real WebSocket; leaving it unbundled avoids the
  // optional-native-dep resolution warnings its bundled form produces.
  serverExternalPackages: ["@neondatabase/serverless"],
};

export default nextConfig;
