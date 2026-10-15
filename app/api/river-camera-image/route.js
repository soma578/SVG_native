export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const MAX_BYTES = 3 * 1024 * 1024
const headers = {
  'Cache-Control': 'no-store',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-Content-Type-Options': 'nosniff',
}

export async function GET(request) {
  const url = new URL(request.url)
  const id = url.searchParams.get('id')
  if (!id || !/^[A-Za-z0-9_-]{1,80}$/.test(id)) {
    return new Response('Invalid camera ID', { status: 400, headers })
  }
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    return new Response('Cross-site access is not allowed', { status: 403, headers })
  }

  const target = `https://cam.river.go.jp/cam/now/${id}.jpg`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const upstream = await fetch(target, {
      cache: 'no-store',
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        Accept: 'image/jpeg',
        Referer: 'https://www.river.go.jp/',
        'User-Agent': 'Mozilla/5.0 (compatible; SVGMap-River-Camera/1.0)',
      },
    })
    const type = upstream.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()
    if (!upstream.ok || type !== 'image/jpeg' || !upstream.body) {
      await upstream.body?.cancel().catch(() => {})
      return new Response('Camera image unavailable', { status: 502, headers })
    }
    const length = Number(upstream.headers.get('content-length') || 0)
    if (length > MAX_BYTES) {
      await upstream.body.cancel().catch(() => {})
      return new Response('Camera image too large', { status: 502, headers })
    }

    const reader = upstream.body.getReader()
    const chunks = []
    let size = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_BYTES) {
        await reader.cancel().catch(() => {})
        return new Response('Camera image too large', { status: 502, headers })
      }
      chunks.push(value)
    }
    const image = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      image.set(chunk, offset)
      offset += chunk.byteLength
    }
    return new Response(image, { headers: { ...headers, 'Content-Type': 'image/jpeg' } })
  } catch (error) {
    console.warn('[river-camera-image] upstream failed', { id, reason: error?.name || 'fetch' })
    return new Response('Camera image unavailable', { status: 502, headers })
  } finally {
    clearTimeout(timeout)
  }
}
