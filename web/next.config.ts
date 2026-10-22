import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false, // hides the dev badge that covered the sidebar
  cacheComponents: true,
  partialPrefetching: true,
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
