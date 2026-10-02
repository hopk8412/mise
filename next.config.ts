import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // A recipe form carries up to a 5 MB photo plus the JSON `data` field (at most 1.5M
      // characters, see src/lib/recipe-form.ts) and multipart overhead. The default is 1 MB.
      bodySizeLimit: "7mb",
    },
  },
};

export default nextConfig;
