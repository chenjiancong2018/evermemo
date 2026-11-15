/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['better-sqlite3', 'sharp'],
  experimental: {
    serverActions: { bodySizeLimit: '25mb' },
  },
};

export default nextConfig;
