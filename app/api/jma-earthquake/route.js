import { relayFixedRequest, readRequestBody, relayError } from '../_lib/fixed-relay.js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(request) {
  let body
  try { body = await readRequestBody(request, 128 * 1024) } catch (error) {
    return relayError(error.message, 413)
  }
  const contentType = request.headers.get('content-type')
  if (!contentType?.startsWith('multipart/form-data;')) return relayError('Expected form data', 415)
  return relayFixedRequest(request, {
    target: 'https://www.data.jma.go.jp/eqdb/data/shindo/api/',
    headers: { 'Content-Type': contentType },
    body,
    maximumResponseBytes: 10 * 1024 * 1024,
  })
}
