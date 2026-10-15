import assert from 'node:assert/strict'
import { GET } from './route.js'

const originalFetch = globalThis.fetch
const seen = []
globalThis.fetch = async (target, options) => {
  seen.push({ target, options })
  return new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), {
    headers: { 'Content-Type': 'image/jpeg', 'Content-Length': '4' },
  })
}
try {
  const request = (id, headers = {}) => new Request(`https://example.com/api/river-camera-image?id=${id}`, { headers })
  const response = await GET(request('311777010'))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'image/jpeg')
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [0xff, 0xd8, 0xff, 0xd9])
  assert.equal(seen[0].target, 'https://cam.river.go.jp/cam/now/311777010.jpg')
  assert.equal(seen[0].options.headers.Referer, 'https://www.river.go.jp/')
  assert.equal(seen[0].options.redirect, 'manual')
  assert.equal((await GET(request('..%2Fprivate'))).status, 400)
  assert.equal((await GET(request('311777010', { 'Sec-Fetch-Site': 'cross-site' }))).status, 403)
  const embedded = await GET(request('311777010', {
    'Sec-Fetch-Site': 'cross-site', 'Sec-Fetch-Dest': 'image',
  }))
  assert.equal(embedded.status, 200)
  assert.equal(embedded.headers.get('cross-origin-resource-policy'), 'cross-origin')
  const sameSiteImage = await GET(request('311777010', {
    'Sec-Fetch-Site': 'same-site', 'Sec-Fetch-Dest': 'image',
  }))
  assert.equal(sameSiteImage.status, 200)
  assert.equal(sameSiteImage.headers.get('cross-origin-resource-policy'), 'cross-origin')
  assert.equal((await GET(request('311777010', {
    'Sec-Fetch-Site': 'cross-site', 'Sec-Fetch-Dest': 'empty',
  }))).status, 403)
  assert.equal(seen.length, 3)

  globalThis.fetch = async () => new Response('blocked', { status: 403, headers: { 'Content-Type': 'text/html' } })
  assert.equal((await GET(request('311777010'))).status, 502)
  globalThis.fetch = async () => new Response(new Uint8Array(4), { headers: { 'Content-Type': 'image/jpeg', 'Content-Length': String(4 * 1024 * 1024) } })
  assert.equal((await GET(request('311777010'))).status, 502)
  console.log('River camera relay fixed target, referer, image checks, and no-store passed')
} finally {
  globalThis.fetch = originalFetch
}
