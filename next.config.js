/** @type {import('next').NextConfig} */
const nextConfig = {
  // A-Frame manages WebGL/DOM imperatively and is not StrictMode-safe:
  // the dev double-mount leaves an orphan <a-scene>. Disable it so the scene is stable.
  reactStrictMode: false,
  images: {
    // 360°/thumbnail assets come from the server storage via absolute URLs (see docs/API.md)
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
};

module.exports = nextConfig;
