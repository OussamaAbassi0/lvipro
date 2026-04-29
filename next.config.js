/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Local /public images don't need a domain — this is just future-proofing
    unoptimized: false,
  },
};

module.exports = nextConfig;
