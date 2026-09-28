const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
}

export function validateSameOriginRequest(request) {
  const requestUrl = new URL(request.url)
  const allowed = new Set([requestUrl.origin])
  const forwardedProtocol = request.headers.get('x-forwarded-proto')?.split(',')[0].trim()
  const protocol = forwardedProtocol ? `${forwardedProtocol.replace(/:$/, '')}:` : requestUrl.protocol
  for (const name of ['x-forwarded-host', 'host']) {
    const host = request.headers.get(name)?.split(',')[0].trim()
    if (!host) continue
    try { allowed.add(new URL(`${protocol}//${host}`).origin) } catch { /* invalid host */ }
  }
  const origin = request.headers.get('origin')
  if (origin && !allowed.has(origin)) throw new Error('Cross-site requests are not allowed')
  const fetchSite = request.headers.get('sec-fetch-site')
  if (fetchSite && fetchSite !== 'same-origin') throw new Error('Cross-site requests are not allowed')
  const referer = request.headers.get('referer')
  if (!origin && referer && !allowed.has(new URL(referer).origin)) {
    throw new Error('Cross-site requests are not allowed')
  }
}

export function noStoreHeaders(contentType = 'application/json; charset=utf-8') {
  return { ...NO_STORE_HEADERS, 'Content-Type': contentType }
}

export function relayError(message, status = 502) {
  return Response.json({ error: message }, { status, headers: noStoreHeaders() })
}

function limitBody(body, maximumBytes) {
  if (!body) return null
  const reader = body.getReader()
  let transferred = 0
  return new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read()
        if (done) return controller.close()
        transferred += value.byteLength
        if (transferred > maximumBytes) {
          await reader.cancel('Response exceeded relay limit')
          return controller.error(new Error('Response exceeded relay limit'))
        }
        controller.enqueue(value)
      } catch (error) {
        controller.error(error)
      }
    },
    cancel(reason) { return reader.cancel(reason) },
  })
}

export async function readRequestBody(request, maximumBytes) {
  const declared = Number(request.headers.get('content-length') || 0)
  if (declared > maximumBytes) throw new Error('Request body is too large')
  const body = await request.arrayBuffer()
  if (body.byteLength > maximumBytes) throw new Error('Request body is too large')
  return body
}

export async function relayFixedRequest(request, {
  target,
  method = request.method,
  headers = {},
  body,
  maximumResponseBytes = 30 * 1024 * 1024,
  timeoutMs = 15_000,
}) {
  try {
    validateSameOriginRequest(request)
  } catch (error) {
    return relayError(error.message, 403)
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  let upstream
  try {
    upstream = await fetch(target, {
      method,
      headers: { Accept: '*/*', ...headers },
      body,
      redirect: 'error',
      cache: 'no-store',
      signal: controller.signal,
    })
  } catch (error) {
    console.error('[fixed-upstream-relay]', target, error)
    return relayError('Upstream request failed')
  } finally {
    clearTimeout(timeout)
  }

  const declared = Number(upstream.headers.get('content-length') || 0)
  if (declared > maximumResponseBytes) {
    await upstream.body?.cancel()
    return relayError('Upstream response is too large', 413)
  }
  const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
  return new Response(limitBody(upstream.body, maximumResponseBytes), {
    status: upstream.status,
    headers: noStoreHeaders(contentType),
  })
}
