import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Client-heavy PWA with on-device state; Cache Components/PPR not needed.
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
