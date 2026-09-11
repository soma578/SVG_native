/** @type {import('next').NextConfig} */
const nextConfig = {
  agentRules: false,
  // Next.js is only a delivery adapter. SVGMap and AppLayers stay as static,
  // browser-native assets and are not transpiled or bundled by Next.js.
  output: 'standalone',
  poweredByHeader: false,
  turbopack: {
    root: process.cwd(),
  },
  async headers() {
    const staticSvgMapHeaders = [
      { key: 'Access-Control-Allow-Origin', value: '*' },
      { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
      { key: 'Cache-Control', value: 'public, no-cache' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
    ]
    return [
      {
        source: '/svgmapjs/:path*',
        headers: staticSvgMapHeaders,
      },
      {
        source: '/svgmapAppLayers/:path*',
        headers: staticSvgMapHeaders,
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, no-cache' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(), microphone=()' },
        ],
      },
    ]
  },
}

export default nextConfig
