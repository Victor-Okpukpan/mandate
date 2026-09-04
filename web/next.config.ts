import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@mandate/ui", "@mandate/shared"],
  reactStrictMode: true,
};

export default nextConfig;
