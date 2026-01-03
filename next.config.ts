import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Allow remote images used on the login page
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  // Ensure environment variables are available
  env: {
    API_URL: process.env.API_URL,
  },
  typescript: {
    // Already checked with tsc, so we know types are correct
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
