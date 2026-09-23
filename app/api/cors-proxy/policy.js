const IMAGE_PATH = /\.(?:gif|jpe?g|png|webp)$/i

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
  },
  {
    id: 'npa-traffic-open-data',
    hostname: 'www.npa.go.jp',
    protocols: ['https:'],
    pathPrefixes: ['/publications/statistics/koutsuu/opendata/'],
  },
  {
    id: 'jma-bosai',
    hostname: 'www.jma.go.jp',
    protocols: ['https:'],
    pathPrefixes: ['/bosai/'],
  },
  {
    id: 'jma-public-data',
    hostname: 'www.data.jma.go.jp',
    protocols: ['https:'],
    pathPrefixes: ['/'],
  },
  {
    id: 'river-public-data',
    hostname: 'www.river.go.jp',
    protocols: ['https:'],
    pathPrefixes: ['/kawabou/'],
  },
  {
    id: 'mlit-official-http-images',
    hostname: 'mlit.go.jp',
    includeSubdomains: true,
    protocols: ['http:', 'https:'],
    pathPattern: IMAGE_PATH,
  },
  {
    id: 'mlit-road-information',
    hostname: 'www.road-info-prvs.mlit.go.jp',
    protocols: ['https:'],
    pathPrefixes: ['/roadinfo/'],
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
