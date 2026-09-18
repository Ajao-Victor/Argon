/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the workspace root so a stray package.json above the repo is ignored.
  turbopack: { root: __dirname },
  // Only NEXT_PUBLIC_* values are ever read in this app (ENGINEERING.md §0.4).
  // Contract addresses may be empty; services/contracts.ts turns that into a
  // "not deployed" state rather than failing the build.
};

module.exports = nextConfig;
