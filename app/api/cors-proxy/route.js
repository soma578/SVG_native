import { findProxyPolicy, validateProxyTarget } from './policy.js'
import https from 'node:https'
import { constants as cryptoConstants } from 'node:crypto'
import { Readable } from 'node:stream'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const MAX_REDIRECTS = 5
const FETCH_TIMEOUT_MS = 15_000
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])
const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-Content-Type-Options': 'nosniff',
}

function proxyErrorHeaders(kind) {
  return { ...NO_STORE_HEADERS, 'X-SVGMap-Proxy-Error': kind }
}

function validateCaller(request) {
  const requestUrl = new URL(request.url)
  const requestOrigins = new Set([requestUrl.origin])
  const forwardedProtocol = request.headers.get('x-forwarded-proto')?.split(',')[0].trim()
  const protocol = forwardedProtocol ? `${forwardedProtocol.replace(/:$/, '')}:` : requestUrl.protocol
  for (const name of ['x-forwarded-host', 'host']) {
    const host = request.headers.get(name)?.split(',')[0].trim()
    if (!host) continue
    try { requestOrigins.add(new URL(`${protocol}//${host}`).origin) } catch { /* invalid host */ }
  }
  const origin = request.headers.get('origin')
  if (origin && !requestOrigins.has(origin)) throw new Error('Cross-site requests are not allowed')

  const fetchSite = request.headers.get('sec-fetch-site')
  if (fetchSite && fetchSite !== 'same-origin') throw new Error('Cross-site requests are not allowed')

  const referer = request.headers.get('referer')
  if (!origin && referer && !requestOrigins.has(new URL(referer).origin)) {
    throw new Error('Cross-site requests are not allowed')
  }
}

function fetchWithLegacyTls(target, { method, signal, headers }) {
  return new Promise((resolve, reject) => {
    const request = https.request(target, {
      method,
      headers: { ...headers, 'Accept-Encoding': 'identity' },
      secureOptions: cryptoConstants.SSL_OP_LEGACY_SERVER_CONNECT,
    })
    const abort = () => request.destroy(new DOMException('Aborted', 'AbortError'))
    signal?.addEventListener('abort', abort, { once: true })
    request.once('error', reject)
    request.once('response', (incoming) => {
      signal?.removeEventListener('abort', abort)
      const responseHeaders = new Headers()
      for (const [name, value] of Object.entries(incoming.headers)) {
        if (Array.isArray(value)) value.forEach((item) => responseHeaders.append(name, item))
        else if (value !== undefined) responseHeaders.set(name, value)
      }
      resolve(new Response(method === 'HEAD' ? null : Readable.toWeb(incoming), {
        status: incoming.statusCode || 502,
        statusText: incoming.statusMessage,
        headers: responseHeaders,
      }))
    })
    request.end()
    if (signal?.aborted) abort()
  })
}

function fetchTarget(target, options) {
  const policy = findProxyPolicy(target)
  if (policy?.legacyTlsHostnames?.includes(target.hostname)) {
    return fetchWithLegacyTls(target, options)
  }
  return fetch(target, options)
}

export function limitResponseBody(body, maximumBytes) {
  if (!body) return null
  const reader = body.getReader()
  let transferred = 0

  return new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read()
        if (done) {
          controller.close()
          return
        }
        transferred += value.byteLength
        if (transferred > maximumBytes) {
          await reader.cancel('Proxy response exceeded its size limit')
          controller.error(new Error('Proxy response exceeded its size limit'))
          return
        }
        controller.enqueue(value)
      } catch (error) {
        controller.error(error)
      }
    },
    cancel(reason) {
      return reader.cancel(reason)
    },
  })
}

async function fetchAllowedTarget(initialTarget, method) {
  let target = initialTarget

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    let upstream

    try {
      upstream = await fetchTarget(target, {
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

    if (!REDIRECT_STATUSES.has(upstream.status)) return { upstream, target }

    const location = upstream.headers.get('location')
    if (!location) throw new Error('Invalid upstream redirect')

    await upstream.body?.cancel()
    const redirectTarget = new URL(location, target)
    try {
      target = validateProxyTarget(redirectTarget.href)
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Redirect target rejected'
      throw new Error(`Redirect target rejected (${redirectTarget.href}): ${reason}`)
    }
  }

  throw new Error('Too many redirects')
}

async function proxy(request, headOnly = false) {
  try {
    validateCaller(request)
  } catch (error) {
    return new Response(error instanceof Error ? error.message : 'Forbidden', {
      status: 403,
      headers: proxyErrorHeaders('caller'),
    })
  }

  const rawTarget = new URL(request.url).searchParams.get('url')
  let target

  try {
    target = validateProxyTarget(rawTarget)
  } catch (error) {
    return new Response(error instanceof Error ? error.message : 'Invalid url', {
      status: 400,
      headers: proxyErrorHeaders('policy'),
    })
  }

  try {
    const result = await fetchAllowedTarget(target, headOnly ? 'HEAD' : 'GET')
    const { upstream } = result
    const policy = findProxyPolicy(result.target)
    const declaredBytes = Number(upstream.headers.get('content-length') || 0)
    if (!policy || (declaredBytes && declaredBytes > policy.maxBytes)) {
      await upstream.body?.cancel()
      return new Response('Upstream response is too large', {
        status: 413,
        headers: proxyErrorHeaders('size'),
      })
    }

    const headers = new Headers(NO_STORE_HEADERS)
    for (const name of ['content-type', 'etag', 'last-modified', 'content-disposition']) {
      const value = upstream.headers.get(name)
      if (value) headers.set(name, value)
    }

    return new Response(headOnly ? null : limitResponseBody(upstream.body, policy.maxBytes), {
      status: upstream.status,
      headers,
    })
  } catch (error) {
    console.error('[svgmap-cors-proxy]', target.href, error)
    return new Response('Upstream request failed', {
      status: 502,
      headers: proxyErrorHeaders('upstream'),
    })
  }
}

export async function GET(request) {
  return proxy(request)
}

export async function HEAD(request) {
  return proxy(request, true)
}
