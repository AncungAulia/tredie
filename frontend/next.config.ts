import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { hostname: 'cdn.helius-rpc.com' },
      { hostname: 'raw.githubusercontent.com' },
      { hostname: 'arweave.net' },
      { hostname: 'pbs.twimg.com' },
      { hostname: 'abs.twimg.com' },
      { hostname: '*.ipfs.nftstorage.link' },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
