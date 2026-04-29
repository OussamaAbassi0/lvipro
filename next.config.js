/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: false,
  },
  // Prevent webpack from bundling Playwright/Puppeteer and their
  // transitive deps (clone-deep, merge-deep, etc.) — they contain
  // dynamic require() calls that the bundler cannot statically analyse.
  serverExternalPackages: [
    'playwright',
    'playwright-extra',
    'playwright-core',
    'puppeteer-extra',
    'puppeteer-extra-plugin-stealth',
    'puppeteer-extra-plugin',
    '@sparticuz/chromium',
  ],
};

module.exports = nextConfig;
