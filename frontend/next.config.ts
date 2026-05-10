import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ["lightweight-charts", "fancy-canvas"],
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
};

export default nextConfig;
