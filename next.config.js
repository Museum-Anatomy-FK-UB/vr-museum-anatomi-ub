/** @type {import('next').NextConfig} */
const nextConfig = {
  // A-Frame manages WebGL/DOM imperatively and is not StrictMode-safe:
  // the dev double-mount leaves an orphan <a-scene>. Disable it so the scene is stable.
  reactStrictMode: false,
  images: {
    // 360°/thumbnail assets come from the server storage via absolute URLs (see docs/API.md)
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      // Some storage servers hand out http:// URLs; the VR panels load photos
      // through the optimizer (components/vr/VRPanels.tsx resolveVrImage).
      { protocol: 'http', hostname: '**' },
    ],
  },
};

module.exports = nextConfig;
