/** @type {import('next').NextConfig} */
const nextConfig = {
  // A-Frame mengelola WebGL/DOM secara imperatif dan tidak StrictMode-safe:
  // double-mount dev menyisakan <a-scene> orphan. Matikan agar scene stabil.
  reactStrictMode: false,
  images: {
    // Aset 360°/thumbnail diambil dari storage server via URL absolut (lihat docs/API.md)
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
};

module.exports = nextConfig;
