import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return ["properties", "units", "rentals", "development"].map((segment) => ({
      destination: "/dashboard",
      permanent: false,
      source: `/${segment}/:path*`,
    }));
  },
  async headers() {
    return [
      {
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
        source: "/sw.js",
      },
      {
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
        source: "/firebase-messaging-sw.js",
      },
      {
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
        source: "/manifest.webmanifest",
      },
    ];
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
