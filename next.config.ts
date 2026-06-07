import type { NextConfig } from "next";

// Pin the project as the workspace/trace root. A stray lockfile in a parent dir
// can otherwise make Next infer the wrong root and break the standalone bundle.
const projectRoot = process.cwd();

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle for small, fast Docker images (Coolify).
  output: "standalone",
  outputFileTracingRoot: projectRoot,
  turbopack: { root: projectRoot },
  poweredByHeader: false,
  reactStrictMode: true,
  // Narria runs fully on the mock AI provider with no external services, so the
  // production build must never require secrets at build time.
  env: {
    NEXT_PUBLIC_SITE_URL:
      process.env.NEXT_PUBLIC_SITE_URL ?? "https://narria.dotbooks.store",
  },
};

export default nextConfig;
