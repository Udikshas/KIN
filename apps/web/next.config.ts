import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker (Coolify): self-contained server in .next/standalone.
  output: "standalone",
  // Monorepo: trace files from the repo root so pnpm-hoisted deps are copied.
  outputFileTracingRoot: path.join(__dirname, "../../"),
  cacheComponents: true,
  partialPrefetching: true,
  // The demo call recordings are static; let browsers keep them for a week and
  // refresh quietly in the background (they only change if the script does).
  async headers() {
    return [
      {
        source: "/audio/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
