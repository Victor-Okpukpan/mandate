import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TS source directly — Next needs to transpile them itself.
  transpilePackages: ["@mandate/ui"],
  reactStrictMode: true,
};

export default nextConfig;
