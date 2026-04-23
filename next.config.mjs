/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3', 'sqlite-vec', 'pdf-parse'],
  },
};

export default nextConfig;
