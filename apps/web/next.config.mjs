/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  transpilePackages: ["@jalsetu/engine", "@jalsetu/dispatch", "@jalsetu/relief", "@jalsetu/shared", "@jalsetu/ui"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=(self)" },
        ],
      },
    ];
  },
};
export default nextConfig;
