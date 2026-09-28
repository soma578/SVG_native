const IMAGE_PATH = /\.(?:gif|jpe?g|png|webp)$/i
const MEBIBYTE = 1024 * 1024

// This is a public, anonymous relay. Keep it limited to known read-only data
// sources used by bundled AppLayers. User-supplied URLs intentionally do not
// belong here; CORS-enabled sources must be fetched directly by those tools.
export const CORS_PROXY_POLICIES = Object.freeze([
  {
    id: 'gsi-public-data',
    hostname: 'gsi.go.jp',
    includeSubdomains: true,
    protocols: ['https:'],
    pathPrefixes: ['/'],
    maxBytes: 30 * MEBIBYTE,
    // www.gsi.go.jp still requests TLS legacy renegotiation. Limit the
    // compatibility transport to this exact official host.
    legacyTlsHostnames: ['www.gsi.go.jp'],
  },
  {
    id: 'npa-traffic-open-data',
    hostname: 'www.npa.go.jp',
    protocols: ['https:'],
    pathPrefixes: ['/publications/statistics/koutsuu/opendata/'],
    maxBytes: 100 * MEBIBYTE,
  },
  {
    id: 'jma-bosai',
    hostname: 'www.jma.go.jp',
    protocols: ['https:'],
    pathPrefixes: ['/bosai/'],
    maxBytes: 30 * MEBIBYTE,
  },
  {
    id: 'jma-public-data',
    hostname: 'www.data.jma.go.jp',
    protocols: ['https:'],
    pathPrefixes: ['/'],
    maxBytes: 30 * MEBIBYTE,
  },
  {
    id: 'river-public-data',
    hostname: 'www.river.go.jp',
    protocols: ['https:'],
    pathPrefixes: ['/kawabou/'],
    maxBytes: 30 * MEBIBYTE,
  },
  {
    id: 'mlit-official-http-images',
    hostname: 'mlit.go.jp',
    includeSubdomains: true,
    protocols: ['http:', 'https:'],
    pathPattern: IMAGE_PATH,
    maxBytes: 15 * MEBIBYTE,
  },
  {
    id: 'mlit-road-information',
    hostname: 'www.road-info-prvs.mlit.go.jp',
    protocols: ['https:'],
    pathPrefixes: ['/roadinfo/'],
    maxBytes: 30 * MEBIBYTE,
  },
  {
    id: 'statistics-bureau-mesh',
    hostname: 'www.stat.go.jp',
    protocols: ['https:'],
    pathPrefixes: ['/data/mesh/'],
    maxBytes: 30 * MEBIBYTE,
  },
  {
    id: 'kontur-open-aerial-map-tiles',
    hostname: 'apps.kontur.io',
    protocols: ['https:'],
    pathPrefixes: ['/raster-tiler/oam/mosaic/'],
    maxBytes: 15 * MEBIBYTE,
  },
  {
    id: 'starlink-gateway-page',
    hostname: 'starlinkinsider.com',
    protocols: ['https:'],
    pathPrefixes: ['/starlink-gateway-locations/'],
    maxBytes: 5 * MEBIBYTE,
  },
  {
    id: 'nra-radiation-monitoring',
    hostname: 'www.ramis.nra.go.jp',
    protocols: ['https:'],
    pathPrefixes: ['/api/v1/map/'],
    maxBytes: 10 * MEBIBYTE,
  },
  {
    id: 'j-shis-geojson',
    hostname: 'www.j-shis.bosai.go.jp',
    protocols: ['https:'],
    pathPrefixes: ['/JSHIS2/GeoJSON/'],
    maxBytes: 30 * MEBIBYTE,
  },
  {
    id: 'mlit-road-disaster-pages',
    hostname: 'www.mlit.go.jp',
    protocols: ['https:'],
    pathPrefixes: ['/road/r6noto/', '/road/saigai/'],
    maxBytes: 100 * MEBIBYTE,
  },
  {
    id: 'usgs-earthquake-feed',
    hostname: 'earthquake.usgs.gov',
    protocols: ['https:'],
    pathPrefixes: ['/earthquakes/feed/v1.0/'],
    maxBytes: 30 * MEBIBYTE,
  },
  {
    id: 'noaa-nowcoast-wms',
    hostname: 'nowcoast.noaa.gov',
    protocols: ['https:'],
    pathPrefixes: ['/geoserver/'],
    maxBytes: 30 * MEBIBYTE,
  },
  {
    id: 'nii-digital-typhoon',
    hostname: 'agora.ex.nii.ac.jp',
    protocols: ['http:', 'https:'],
    pathPrefixes: [
      '/cgi-bin/tile/',
      '/cgi-bin/cps/',
      '/digital-typhoon/gpv/wind/',
      '/earthquake/201103-eastjapan/weather/gpv/rain/tile/',
    ],
    maxBytes: 30 * MEBIBYTE,
  },
  {
    id: 'jtwc-public-products',
    hostname: 'www.metoc.navy.mil',
    protocols: ['https:'],
    pathPrefixes: ['/jtwc/products/', '/jtwc/rss/'],
    maxBytes: 30 * MEBIBYTE,
  },
  {
    id: 'jaxa-gsmap-now',
    hostname: 'sharaku.eorc.jaxa.jp',
    protocols: ['https:'],
    pathPrefixes: ['/GSMaP_NOW/'],
    maxBytes: 10 * MEBIBYTE,
  },
  {
    id: 'bodik-open-data-api',
    hostname: 'data.bodik.jp',
    protocols: ['https:'],
    pathPrefixes: ['/api/3/action/'],
    maxBytes: 30 * MEBIBYTE,
  },
  {
    id: 'yamaguchi-open-data-api',
    hostname: 'yamaguchi-opendata.jp',
    protocols: ['https:'],
    pathPrefixes: ['/ckan/api/3/action/'],
    maxBytes: 30 * MEBIBYTE,
  },
  {
    id: 'jice-public-gis',
    hostname: 'www.jice.or.jp',
    protocols: ['https:'],
    pathPrefixes: ['/cms/gis/'],
    maxBytes: 30 * MEBIBYTE,
  },
  {
    id: 'qsr-mlit-disaster-info',
    hostname: 'www.qsr.mlit.go.jp',
    protocols: ['https:'],
    pathPrefixes: ['/bousai_joho/'],
    maxBytes: 30 * MEBIBYTE,
  },
  {
    id: 'mobilitydata-gbfs-catalog',
    hostname: 'raw.githubusercontent.com',
    protocols: ['https:'],
    pathPrefixes: ['/MobilityData/gbfs/'],
    maxBytes: 10 * MEBIBYTE,
  },
  {
    id: 'cyclocity-toyama-gbfs',
    hostname: 'api.cyclocity.fr',
    protocols: ['https:'],
    pathPrefixes: ['/contracts/toyama/gbfs/'],
    maxBytes: 10 * MEBIBYTE,
  },
  {
    id: 'odpt-public-gbfs',
    hostname: 'api-public.odpt.org',
    protocols: ['https:'],
    pathPrefixes: ['/api/v4/gbfs/'],
    maxBytes: 10 * MEBIBYTE,
  },
  {
    id: 'odpt-dataset-catalog',
    hostname: 'ckan.odpt.org',
    protocols: ['https:'],
    pathPrefixes: ['/dataset/'],
    maxBytes: 30 * MEBIBYTE,
  },
  {
    id: 'mhlw-public-data-pages',
    hostname: 'www.mhlw.go.jp',
    protocols: ['https:'],
    pathPrefixes: [
      '/stf/kayoinoba_opendata_',
      '/stf/seisakunitsuite/bunya/kenkou_iryou/iryou/',
      '/content/',
    ],
    maxBytes: 30 * MEBIBYTE,
  },
  {
    id: 'pedestrian-space-railway-data',
    hostname: 'www.hokoukukan.go.jp',
    protocols: ['https:'],
    pathPrefixes: ['/uploads/'],
    maxBytes: 30 * MEBIBYTE,
  },
  {
    id: 'iot-weather-box-public-api',
    hostname: 'iot100.uchida.co.jp',
    protocols: ['https:'],
    pathPrefixes: ['/iot100api/public/'],
    maxBytes: 10 * MEBIBYTE,
  },
  {
    id: 'environment-air-monitoring',
    hostname: 'soramame.env.go.jp',
    protocols: ['https:'],
    pathPrefixes: ['/data/sokutei/noudoAll/', '/data/map/', '/data/map_legend.json'],
    maxBytes: 30 * MEBIBYTE,
  },
  {
    id: 'svgmap-odpt-gtfs-relay',
    hostname: 'odpt-bus-proxy.svgmap.workers.dev',
    protocols: ['https:'],
    pathPrefixes: ['/gtfs/'],
    maxBytes: 30 * MEBIBYTE,
  },
])

function matchesHostname(hostname, policy) {
  return hostname === policy.hostname
    || (policy.includeSubdomains && hostname.endsWith(`.${policy.hostname}`))
}

export function findProxyPolicy(url) {
  let pathname
  try {
    pathname = decodeURIComponent(url.pathname)
  } catch {
    return null
  }
  if (pathname.includes('\\') || pathname.split('/').some((part) => part === '.' || part === '..')) {
    return null
  }

  return CORS_PROXY_POLICIES.find((policy) => {
    if (!matchesHostname(url.hostname, policy) || !policy.protocols.includes(url.protocol)) {
      return false
    }
    if (policy.pathPrefixes?.some((prefix) => pathname.startsWith(prefix))) return true
    return policy.pathPattern?.test(pathname) || false
  }) || null
}

export function validateProxyTarget(rawUrl) {
  if (!rawUrl) throw new Error('Missing url')

  const url = new URL(rawUrl)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Protocol not allowed')
  if (url.username || url.password) throw new Error('Credentials in URL are not allowed')
  if (url.port) throw new Error('Custom ports are not allowed')
  if (!findProxyPolicy(url)) throw new Error(`Target not allowed: ${url.hostname}`)

  return url
}
