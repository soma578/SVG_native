import { createHash, timingSafeEqual } from 'node:crypto'
import { normalizePayload } from './normalize.js'
import { appendMizupiguiEvents } from './sheet.js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const MAX_BODY_BYTES = 64 * 1024
const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'private, no-store, max-age=0',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
}

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers })
}

function keyMatches(provided, expected) {
  const a = createHash('sha256').update(provided || '').digest()
  const b = createHash('sha256').update(expected || '').digest()
  return timingSafeEqual(a, b)
}

async function readJson(request) {
  const reader = request.body?.getReader()
  if (!reader) throw new Error('Request body required')
  const parts = []
  let bytes = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    bytes += value.byteLength
    if (bytes > MAX_BODY_BYTES) {
      await reader.cancel()
      throw new Error('Request body exceeds 64 KiB')
    }
    parts.push(value)
  }
  const body = new Uint8Array(bytes)
  let offset = 0
  for (const part of parts) {
    body.set(part, offset)
    offset += part.byteLength
  }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body))
}

export async function handlePost(request, options = {}) {
  const apiKey = options.apiKey ?? process.env.MIZUPIGUI_API_KEY
  const spreadsheetId = options.spreadsheetId ?? process.env.MIZUPIGUI_SHEET_ID
  const sheetName = options.sheetName ?? process.env.MIZUPIGUI_SHEET_NAME ?? 'history'
  const credentialsJson = options.credentialsJson ?? process.env.SVG3_GOOGLE_SERVICE_ACCOUNT_JSON
  const persist = options.persist ?? appendMizupiguiEvents
  if (!apiKey || apiKey.length < 32 || !spreadsheetId || !credentialsJson || !/^[\w-]{10,}$/.test(spreadsheetId) || !sheetName || /[\r\n]/.test(sheetName)) {
    return json(503, { error: 'Receiver is not configured' })
  }
  if (!keyMatches(request.headers.get('x-api-key'), apiKey)) return json(401, { error: 'Unauthorized' })
  if (!/^application\/json(?:\s*;|\s*$)/i.test(request.headers.get('content-type') || '')) {
    return json(415, { error: 'Content-Type must be application/json' })
  }
  let payload
  try {
    payload = normalizePayload(await readJson(request))
  } catch (error) {
    return json(400, { error: error.message === 'Request body exceeds 64 KiB' ? error.message : 'Invalid JSON payload' })
  }
  try {
    const result = await persist({ spreadsheetId, sheetName, credentialsJson, ...payload })
    return json(result.inserted ? 201 : 200, { ok: true, ...result })
  } catch (error) {
    console.error('[mizupigui] persist failed', { error: error?.message === 'Mizupigui sheet header does not match the configured schema' ? 'sheet-schema' : 'sheets-request' })
    return json(503, { error: 'Storage temporarily unavailable' })
  }
}

export async function POST(request) {
  return handlePost(request)
}
