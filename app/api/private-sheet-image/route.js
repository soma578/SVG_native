import { GoogleAuth } from 'google-auth-library'
import { verifyPrivateDriveImageRequest } from '../private-sheet-csv/drive-photo.js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_IMAGE_BYTES = 4_000_000 // Vercel Functions have a 4.5 MB response limit.
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])
const privateHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
}

function isTrustedThumbnailUrl(raw) {
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' && (
      url.hostname === 'drive.google.com' || url.hostname === 'googleusercontent.com'
      || url.hostname.endsWith('.googleusercontent.com')
    ) ? url : null
  } catch {
    return null
  }
}

async function readBrowserImage(response, expectedType = null) {
  const mimeType = (response.headers.get('content-type') || '').split(';')[0].toLowerCase()
  const byteCount = Number(response.headers.get('content-length') || 0)
  if (!response.ok || (mimeType && mimeType !== expectedType && !IMAGE_TYPES.has(mimeType)
    && mimeType !== 'application/octet-stream') || byteCount > MAX_IMAGE_BYTES) return null
  const chunks = []
  let size = 0
  const reader = response.body?.getReader()
  if (!reader) return null
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_IMAGE_BYTES) {
      await reader.cancel()
      return null
    }
    chunks.push(Buffer.from(value))
  }
  if (!size) return null
  return { body: Buffer.concat(chunks), mimeType: IMAGE_TYPES.has(mimeType) ? mimeType : expectedType }
}

function imageResponse(image) {
  return new Response(image.body, {
    headers: { ...privateHeaders, 'Content-Type': image.mimeType,
      'Content-Length': String(image.body.byteLength) },
  })
}

async function trySharedThumbnail(fileId, resourceKey) {
  // Best-effort fallback for a Drive photo explicitly shared for link viewing.
  // The URL is built from validated tokens after our signed-route check; no
  // arbitrary CSV URL is fetched by this endpoint.
  try {
    const url = new URL('https://drive.google.com/thumbnail')
    url.searchParams.set('id', fileId)
    url.searchParams.set('sz', 'w1600')
    if (resourceKey) url.searchParams.set('resourcekey', resourceKey)
    let currentUrl = url
    let response = null
    for (let redirects = 0; redirects < 3; redirects++) {
      response = await fetch(currentUrl, {
        cache: 'no-store', redirect: 'manual', headers: { Accept: 'image/*' },
      })
      if (response.status < 300 || response.status >= 400) break
      const location = response.headers.get('location')
      const nextUrl = location ? isTrustedThumbnailUrl(new URL(location, currentUrl).href) : null
      if (!nextUrl) return null
      currentUrl = nextUrl
    }
    if (!response || (response.status >= 300 && response.status < 400)) return null
    const mimeType = (response.headers.get('content-type') || '').split(';')[0].toLowerCase()
    if (!IMAGE_TYPES.has(mimeType)) return null
    const image = await readBrowserImage(response, mimeType)
    if (!image) return null
    console.warn('Private Drive image used a link-shared thumbnail fallback')
    return imageResponse(image)
  } catch {
    return null
  }
}

export async function GET(request) {
  const requestUrl = new URL(request.url)
  const fileId = requestUrl.searchParams.get('id')
  const resourceKey = requestUrl.searchParams.get('resourcekey') || ''
  const signature = requestUrl.searchParams.get('sig')
  let credentials
  try {
    credentials = JSON.parse(process.env.SVG3_GOOGLE_SERVICE_ACCOUNT_JSON || '')
    if (credentials.type !== 'service_account' || !credentials.client_email || !credentials.private_key) {
      throw new Error('Invalid service account')
    }
  } catch {
    return new Response('Private Drive image is not configured', { status: 503, headers: privateHeaders })
  }
  if (!verifyPrivateDriveImageRequest(fileId, resourceKey, signature, credentials.private_key)) {
    return new Response('Invalid private image URL', { status: 400, headers: privateHeaders })
  }

  try {
    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    })
    const client = await auth.getClient()
    const googleHeaders = resourceKey
      ? { 'X-Goog-Drive-Resource-Keys': `${fileId}/${resourceKey}` }
      : {}
    const metadataUrl = new URL(`https://www.googleapis.com/drive/v3/files/${fileId}`)
    metadataUrl.searchParams.set('fields', 'mimeType,size,thumbnailLink,capabilities(canDownload)')
    metadataUrl.searchParams.set('supportsAllDrives', 'true')
    const metadataResponse = await client.request({ url: metadataUrl.href, headers: googleHeaders })
    const mimeType = metadataResponse.data?.mimeType
    const declaredSize = Number(metadataResponse.data?.size || 0)
    if (!IMAGE_TYPES.has(mimeType) || metadataResponse.data?.capabilities?.canDownload === false) {
      return new Response('Drive file is not a downloadable browser image', { status: 415, headers: privateHeaders })
    }
    const accessToken = (await client.getAccessToken()).token
    if (!accessToken) throw new Error('Missing Google access token')
    // Drive's official thumbnailLink is short-lived, so resolve it per request
    // rather than placing it in CSV. This also keeps large original photos under
    // Vercel's Function response limit when a thumbnail is available.
    const thumbnailUrl = isTrustedThumbnailUrl(metadataResponse.data?.thumbnailLink)
    if (thumbnailUrl) {
      try {
        const thumbnailResponse = await fetch(thumbnailUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: 'no-store',
        })
        const thumbnail = await readBrowserImage(thumbnailResponse, mimeType)
        if (thumbnail) return imageResponse(thumbnail)
      } catch {
        // A missing thumbnail is not fatal; try the authenticated original.
      }
    }
    if (declaredSize > MAX_IMAGE_BYTES) {
      const sharedThumbnail = await trySharedThumbnail(fileId, resourceKey)
      if (sharedThumbnail) return sharedThumbnail
      return new Response('Drive image exceeds the delivery limit', { status: 413, headers: privateHeaders })
    }
    const mediaUrl = new URL(`https://www.googleapis.com/drive/v3/files/${fileId}`)
    mediaUrl.searchParams.set('alt', 'media')
    mediaUrl.searchParams.set('supportsAllDrives', 'true')
    const media = await fetch(mediaUrl, {
      headers: { ...googleHeaders, Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })
    const image = await readBrowserImage(media, mimeType)
    if (!image) throw new Error('Drive returned no usable image media')
    return imageResponse(image)
  } catch (error) {
    const sharedThumbnail = await trySharedThumbnail(fileId, resourceKey)
    if (sharedThumbnail) return sharedThumbnail
    const httpStatus = error?.response?.status
    const googleStatus = error?.response?.data?.error?.status
    console.error('Private Drive image fetch failed', {
      httpStatus: Number.isInteger(httpStatus) ? httpStatus : null,
      googleStatus: typeof googleStatus === 'string' && /^[A-Z_]{1,50}$/.test(googleStatus)
        ? googleStatus : null,
    })
    // Never expose credentials, private Drive IDs, or Google errors to the browser.
    return new Response('Private Drive image is unavailable', { status: 502, headers: privateHeaders })
  }
}
