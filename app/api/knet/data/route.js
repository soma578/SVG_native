import { relayFixedRequest, relayError } from '../../_lib/fixed-relay.js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const ALLOWED_PATHS = new Set([
  'autopublish/api/smlist/',
  'autopublish/api/smreplist/',
  'eqdownload/api/eqsearch/',
  'eqdownload/api/eqreportsearch/',
])

export async function POST(request) {
  const url = new URL(request.url)
  const path = url.searchParams.get('path') || ''
  const cookie = url.searchParams.get('cookie') || ''
  if (!ALLOWED_PATHS.has(path)) return relayError('Unsupported K-NET API path', 400)
  if (!/^csrftoken=[A-Za-z0-9_-]{16,256}$/.test(cookie)) return relayError('Invalid K-NET token', 400)
  const declared = Number(request.headers.get('content-length') || 0)
  if (declared > 128 * 1024) return relayError('Request body is too large', 413)

  let formData
  try { formData = await request.formData() } catch { return relayError('Expected form data', 415) }
  const encoded = new URLSearchParams()
  for (const [key, value] of formData.entries()) {
    if (typeof value !== 'string') return relayError('File uploads are not supported', 400)
    encoded.append(key, value)
  }
  const csrf = encoded.get('csrfmiddlewaretoken') || ''
  if (!/^[A-Za-z0-9_-]{16,256}$/.test(csrf)) return relayError('Invalid CSRF token', 400)
  return relayFixedRequest(request, {
    target: `https://www.kyoshin.bosai.go.jp/ja/${path}`,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-CSRFToken': csrf,
      'X-Requested-With': 'XMLHttpRequest',
      Referer: 'https://www.kyoshin.bosai.go.jp/ja/',
      Cookie: cookie,
    },
    body: encoded.toString(),
    maximumResponseBytes: 15 * 1024 * 1024,
  })
}
