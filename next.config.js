/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/data-deletion',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://www.facebook.com",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
