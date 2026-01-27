/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable image optimization for simpler deployment
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
