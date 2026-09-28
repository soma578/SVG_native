import assert from 'node:assert/strict'
import { GET, HEAD, limitResponseBody } from '../app/api/cors-proxy/route.js'
import { findProxyPolicy, validateProxyTarget } from '../app/api/cors-proxy/policy.js'

const allowed = [
  'https://hinanmap.gsi.go.jp/hinanjocp/defaultFtpData/csv/mergeFromCity_1.csv',
  'https://www.npa.go.jp/publications/statistics/koutsuu/opendata/2024/honhyo_2024.csv',
  'https://www.jma.go.jp/bosai/amedas/data/latest_time.txt',
  'https://www.data.jma.go.jp/eqdb/data/shindo/api/',
  'https://www.river.go.jp/kawabou/file/system/rwCrntTime.json',
  'http://www.hrr.mlit.go.jp/camera/current.jpg',
  'https://www.stat.go.jp/data/mesh/m_itiran.html',
  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson',
  'https://nowcoast.noaa.gov/geoserver/satellite/wms',
  'http://agora.ex.nii.ac.jp/digital-typhoon/gpv/wind/msm/info/surf.json',
  'https://agora.ex.nii.ac.jp/earthquake/201103-eastjapan/weather/gpv/rain/tile/blank.png',
  'https://www.metoc.navy.mil/jtwc/rss/jtwc.rss',
  'https://www.mlit.go.jp/road/saigai/r8kumamoto/map.zip',
  'https://raw.githubusercontent.com/MobilityData/gbfs/master/systems.csv',
  'https://soramame.env.go.jp/data/sokutei/noudoAll/metadata.json',
  'https://www.mhlw.go.jp/content/12300000/202606.csv',
  'https://soramame.env.go.jp/data/map/kyokuNoudo/2026/09/26/01.csv',
  'https://odpt-bus-proxy.svgmap.workers.dev/gtfs/example_vehicle',
]
for (const rawUrl of allowed) {
  const url = validateProxyTarget(rawUrl)
  assert(findProxyPolicy(url), `Expected an allowlist policy for ${rawUrl}`)
}

const rejected = [
  '',
  'ftp://www.gsi.go.jp/file.csv',
  'https://www.gsi.go.jp:8443/file.csv',
  'https://user:password@www.gsi.go.jp/file.csv',
  'https://www.gsi.go.jp.evil.example/file.csv',
  'https://www.npa.go.jp/',
  'https://www.npa.go.jp/publications/statistics/koutsuu/opendata/%2e%2e/private.csv',
  'http://www.hrr.mlit.go.jp/data/private.json',
  'https://example.com/user-supplied.kml',
  'https://raw.githubusercontent.com/another-owner/private/main/secret.txt',
  'http://agora.ex.nii.ac.jp/unrelated/page.html',
  'https://www.mlit.go.jp/other/file.zip',
  'https://odpt-bus-proxy.svgmap.workers.dev/admin',
]
for (const rawUrl of rejected) {
  assert.throws(() => validateProxyTarget(rawUrl), undefined, `Expected rejection for ${rawUrl}`)
}

const originalFetch = globalThis.fetch
try {
  let seenMethod = null
  globalThis.fetch = async (_url, options) => {
    seenMethod = options.method
    return new Response('a,b\n1,2\n', {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Cache-Control': 'public, max-age=60',
        'Content-Encoding': 'gzip',
        'Content-Length': '12345',
        'Set-Cookie': 'secret=value',
      },
    })
  }

  const requestUrl = new URL('http://localhost/api/cors-proxy')
  requestUrl.searchParams.set('url', allowed[0])
  const response = await GET(new Request(requestUrl))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'text/csv')
  assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0')
  assert.equal(response.headers.get('cdn-cache-control'), 'no-store')
  assert.equal(response.headers.get('vercel-cdn-cache-control'), 'no-store')
  assert.equal(response.headers.get('content-encoding'), null)
  assert.equal(response.headers.get('content-length'), null)
  assert.equal(response.headers.get('set-cookie'), null)
  assert.equal(await response.text(), 'a,b\n1,2\n')
  assert.equal(seenMethod, 'GET')

  const headResponse = await HEAD(new Request(requestUrl, { method: 'HEAD' }))
  assert.equal(headResponse.status, 200)
  assert.equal(await headResponse.text(), '')
  assert.equal(seenMethod, 'HEAD')

  let crossSiteFetchCalled = false
  globalThis.fetch = async () => {
    crossSiteFetchCalled = true
    return new Response('should not be reached')
  }
  const crossSiteResponse = await GET(new Request(requestUrl, {
    headers: { Origin: 'https://attacker.example', 'Sec-Fetch-Site': 'cross-site' },
  }))
  assert.equal(crossSiteResponse.status, 403)
  assert.equal(crossSiteResponse.headers.get('x-svgmap-proxy-error'), 'caller')
  assert.equal(crossSiteFetchCalled, false)

  globalThis.fetch = async () => new Response('host alias accepted')
  const hostAliasResponse = await GET(new Request(requestUrl, {
    headers: {
      Host: '127.0.0.1:3000',
      Referer: 'http://127.0.0.1:3000/svgmapAppLayers/controller.html',
    },
  }))
  assert.equal(hostAliasResponse.status, 200)

  globalThis.fetch = async () => new Response('too large', {
    status: 200,
    headers: { 'Content-Length': String(31 * 1024 * 1024) },
  })
  const declaredTooLargeResponse = await GET(new Request(requestUrl))
  assert.equal(declaredTooLargeResponse.status, 413)
  assert.equal(declaredTooLargeResponse.headers.get('x-svgmap-proxy-error'), 'size')

  const limitedBody = limitResponseBody(new Response('123456').body, 5)
  await assert.rejects(() => new Response(limitedBody).text(), /size limit/)

  globalThis.fetch = async () => new Response(null, {
    status: 302,
    headers: { Location: 'https://example.com/private' },
  })
  const originalConsoleError = console.error
  console.error = () => {}
  try {
    const redirectResponse = await GET(new Request(requestUrl))
    assert.equal(redirectResponse.status, 502, 'Redirects must be checked against the allowlist')
  } finally {
    console.error = originalConsoleError
  }
} finally {
  globalThis.fetch = originalFetch
}

console.log('[cors-proxy] policy, cache/header safety, size limits, caller checks, streaming, HEAD, and redirects passed')
