import { createHmac, timingSafeEqual } from 'node:crypto'

const DRIVE_HOST = 'drive.google.com'
const DRIVE_TOKEN = /^[A-Za-z0-9_-]+$/

export function parseDrivePhotoUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null
  try {
    const url = new URL(raw.trim())
    if (url.protocol !== 'https:' || url.hostname !== DRIVE_HOST) return null
    const match = url.pathname.match(/^\/file\/d\/([A-Za-z0-9_-]+)(?:\/|$)/)
    const fileId = match?.[1] || (url.pathname === '/open' ? url.searchParams.get('id') : null)
    const resourceKey = url.searchParams.get('resourcekey') || ''
    if (!DRIVE_TOKEN.test(fileId || '') || (resourceKey && !DRIVE_TOKEN.test(resourceKey))) return null
    return { fileId, resourceKey }
  } catch {
    return null
  }
}

function photoSignature(fileId, resourceKey, signingKey) {
  return createHmac('sha256', signingKey).update(`private-sheet-image\n${fileId}\n${resourceKey}`).digest('base64url')
}

export function buildPrivateDriveImageUrl(raw, signingKey) {
  const drive = parseDrivePhotoUrl(raw)
  if (!drive || !signingKey) return null
  const params = new URLSearchParams({
    id: drive.fileId,
    sig: photoSignature(drive.fileId, drive.resourceKey, signingKey),
    source: raw.trim(),
  })
  if (drive.resourceKey) params.set('resourcekey', drive.resourceKey)
  return `/api/private-sheet-image?${params}`
}

export function verifyPrivateDriveImageRequest(fileId, resourceKey, signature, signingKey) {
  if (!DRIVE_TOKEN.test(fileId || '') || (resourceKey && !DRIVE_TOKEN.test(resourceKey))
    || !signingKey || typeof signature !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(signature)) return false
  const expected = Buffer.from(photoSignature(fileId, resourceKey || '', signingKey))
  const actual = Buffer.from(signature)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}
