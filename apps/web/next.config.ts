import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/p/o/:token", destination: "/partner/order/:token" },
      { source: "/p/r/:token", destination: "/partner/replenishment/:token" },
    ];
  },
};

export default nextConfig;
