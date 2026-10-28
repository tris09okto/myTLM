import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb', // Mengizinkan payload Server Actions hingga 10MB
    },
  },
};

export default nextConfig;