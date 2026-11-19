import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    // В devDependencies не установлен eslint
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;