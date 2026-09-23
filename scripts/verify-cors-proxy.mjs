import assert from 'node:assert/strict'
import { GET, HEAD } from '../app/api/cors-proxy/route.js'
import { findProxyPolicy, validateProxyTarget } from '../app/api/cors-proxy/policy.js'

const allowed = [
  'https://hinanmap.gsi.go.jp/hinanjocp/defaultFtpData/csv/mergeFromCity_1.csv',
  'https://www.npa.go.jp/publications/statistics/koutsuu/opendata/2024/honhyo_2024.csv',
  'https://www.jma.go.jp/bosai/amedas/data/latest_time.txt',
  'https://www.data.jma.go.jp/eqdb/data/shindo/api/',
  'https://www.river.go.jp/kawabou/file/system/rwCrntTime.json',
  'http://www.hrr.mlit.go.jp/camera/current.jpg',
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
      headers: { 'Content-Type': 'text/csv', 'Cache-Control': 'public, max-age=60' },
    })
  }

  const requestUrl = new URL('http://localhost/api/cors-proxy')
  requestUrl.searchParams.set('url', allowed[0])
  const response = await GET(new Request(requestUrl))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'text/csv')
  assert.equal(response.headers.get('cache-control'), 'public, max-age=60')
  assert.equal(await response.text(), 'a,b\n1,2\n')
  assert.equal(seenMethod, 'GET')

  const headResponse = await HEAD(new Request(requestUrl, { method: 'HEAD' }))
  assert.equal(headResponse.status, 200)
  assert.equal(await headResponse.text(), '')
  assert.equal(seenMethod, 'HEAD')

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

console.log('[cors-proxy] URL policy, streaming response, HEAD, and redirect rejection passed')
