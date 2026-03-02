import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'oldschool.runescape.wiki',
        pathname: '/images/**',
      },
    ],
  },
};

export default nextConfig;
