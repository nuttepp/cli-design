import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin tracing to this project (not a parent dir with a stray lockfile)
  outputFileTracingRoot: __dirname,
  // Don't traverse user workspace folders during dev/build
  outputFileTracingExcludes: {
    "*": ["./workspaces/**/*"],
  },
};

export default nextConfig;
