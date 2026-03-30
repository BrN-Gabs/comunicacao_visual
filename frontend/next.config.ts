import type { NextConfig } from "next";

const internalApiUrl =
  process.env.INTERNAL_API_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

const nextConfig: NextConfig = {
  experimental: {
    proxyClientMaxBodySize: "250mb",
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${internalApiUrl}/api/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${internalApiUrl}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
