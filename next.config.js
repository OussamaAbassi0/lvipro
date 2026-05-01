/** @type {import('next').NextConfig} */

const BROWSER_EXTERNALS = [
  'playwright-core',
  'playwright',
  '@sparticuz/chromium',
];

const nextConfig = {
  images: {
    unoptimized: false,
  },

  // Next.js 14.x key (moved to top-level in v15)
  experimental: {
    serverComponentsExternalPackages: BROWSER_EXTERNALS,
    // Force-include sparticuz binaries (al2023.tar.br holds libnss3.so + glibc-compat libs).
    // Without this, Vercel's file-tracer skips externalized packages → /tmp/chromium
    // launches but its loader cannot find libnss3 because the .br archives
    // were never bundled into the function deployment.
    outputFileTracingIncludes: {
      'app/api/scraper/playwright/route': [
        './node_modules/@sparticuz/chromium/bin/**',
        './node_modules/@sparticuz/chromium/build/**',
      ],
    },
  },

  webpack: (config, { isServer }) => {
    if (!isServer) return config;

    // Belt-and-suspenders: add as webpack externals so the bundler
    // never tries to parse these packages even if the above key is ignored.
    const prev = config.externals || [];
    config.externals = [
      ...(Array.isArray(prev) ? prev : [prev]),
      ...BROWSER_EXTERNALS,
    ];

    return config;
  },
};

module.exports = nextConfig;
