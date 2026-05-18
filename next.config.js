/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for Docker multi-stage builds — produces .next/standalone
  output: 'standalone',

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'hg-static.hyperguest.com',
      },
      {
        protocol: 'https',
        hostname: '*.hyperguest.com',
      },
    ],
  },

  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals)
          ? config.externals
          : [config.externals].filter(Boolean)),
        'mssql',
        'tedious',
        'es-aggregate-error',
      ];
    }

    return config;
  },

  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;