const DRIVE_HOSTNAME = 'drive.google.com'
const MAX_IMAGE_BYTES = 20 * 1024 * 1024

function isSafeDriveToken(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]+$/.test(value)
}

export async function GET(request) {
  const requestUrl = new URL(request.url)
  const fileId = requestUrl.searchParams.get('id')
  const resourceKey = requestUrl.searchParams.get('resourcekey')

  if (!isSafeDriveToken(fileId) || (resourceKey && !isSafeDriveToken(resourceKey))) {
    return new Response('Invalid Google Drive image URL', { status: 400 })
  }

  const driveUrl = new URL(`https://${DRIVE_HOSTNAME}/thumbnail`)
  driveUrl.searchParams.set('id', fileId)
  driveUrl.searchParams.set('sz', 'w1600')
  if (resourceKey) driveUrl.searchParams.set('resourcekey', resourceKey)

  try {
    const driveResponse = await fetch(driveUrl, {
      redirect: 'follow',
      cache: 'no-store',
      headers: { Accept: 'image/*' },
    })
    const contentType = driveResponse.headers.get('content-type') || ''
    const contentLength = Number(driveResponse.headers.get('content-length') || 0)
    if (
      !driveResponse.ok ||
      !contentType.toLowerCase().startsWith('image/') ||
      (contentLength && contentLength > MAX_IMAGE_BYTES)
    ) {
      return new Response('Google Drive image is unavailable', { status: 502 })
    }

    const image = await driveResponse.arrayBuffer()
    if (image.byteLength > MAX_IMAGE_BYTES) {
      return new Response('Google Drive image is too large', { status: 413 })
    }

    return new Response(image, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(image.byteLength),
        'Cache-Control': 'private, no-cache',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (_error) {
    return new Response('Google Drive image request failed', { status: 502 })
  }
}
