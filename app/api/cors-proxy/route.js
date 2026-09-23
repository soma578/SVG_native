import { validateProxyTarget } from './policy.js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const MAX_REDIRECTS = 5
const FETCH_TIMEOUT_MS = 15_000
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

async function fetchAllowedTarget(initialTarget, method) {
  let target = initialTarget

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    let upstream

    try {
      upstream = await fetch(target, {
        method,
        redirect: 'manual',
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          'User-Agent': 'SVGMap-CORS-Proxy/1.0',
          Accept: '*/*',
        },
      })
    } finally {
      clearTimeout(timeout)
    }

    if (!REDIRECT_STATUSES.has(upstream.status)) return upstream

    const location = upstream.headers.get('location')
    if (!location) throw new Error('Invalid upstream redirect')

    await upstream.body?.cancel()
    target = validateProxyTarget(new URL(location, target).href)
  }

  throw new Error('Too many redirects')
}

async function proxy(request, headOnly = false) {
  const rawTarget = new URL(request.url).searchParams.get('url')
  let target

  try {
    target = validateProxyTarget(rawTarget)
  } catch (error) {
    return new Response(error instanceof Error ? error.message : 'Invalid url', { status: 400 })
  }

  try {
    const upstream = await fetchAllowedTarget(target, headOnly ? 'HEAD' : 'GET')
    const headers = new Headers({ 'X-Content-Type-Options': 'nosniff' })
    for (const name of ['content-type', 'etag', 'last-modified', 'content-disposition']) {
      const value = upstream.headers.get(name)
      if (value) headers.set(name, value)
    }
    headers.set('Cache-Control', upstream.headers.get('cache-control') || 'no-store')

    return new Response(headOnly ? null : upstream.body, {
      status: upstream.status,
      headers,
    })
  } catch (error) {
    console.error('[svgmap-cors-proxy]', target.href, error)
    return new Response('Upstream request failed', { status: 502 })
  }
}

export async function GET(request) {
  return proxy(request)
}

export async function HEAD(request) {
  return proxy(request, true)
}
