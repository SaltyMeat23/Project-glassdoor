import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Dev is accessed via 127.0.0.1/localhost; allow those origins so Next serves
  // the client/RSC payloads (otherwise the page renders but never hydrates).
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
};

export default nextConfig;
