import { relayFixedRequest, readRequestBody, relayError } from '../_lib/fixed-relay.js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const ALLOWED_LAYERS = new Set([
  'aaa81ee7-f2af-44fe-a6d1-2f8e0b834056',
  '25f37bd7-da6b-4003-ba19-4209efad176c',
])

function validPayload(payload) {
  const extent = payload?.extent
  const values = [extent?.lat1, extent?.lat2, extent?.lon1, extent?.lon2].map(Number)
  return payload?.systemID === 'd45b4360-2d8f-86e0-84e1-9d5949e3624d'
    && Array.isArray(payload.layerIdArr)
    && payload.layerIdArr.length === 1
    && ALLOWED_LAYERS.has(payload.layerIdArr[0])
    && values.every(Number.isFinite)
    && values[0] >= 20 && values[0] <= 50
    && values[1] >= 20 && values[1] <= 50
    && values[2] >= 120 && values[2] <= 155
    && values[3] >= 120 && values[3] <= 155
    && Math.abs(values[0] - values[1]) <= 0.1
    && Math.abs(values[2] - values[3]) <= 0.1
}

export async function POST(request) {
  let body
  try { body = await readRequestBody(request, 32 * 1024) } catch (error) {
    return relayError(error.message, 413)
  }
  let payload
  try { payload = JSON.parse(new TextDecoder().decode(body)) } catch {
    return relayError('Invalid JSON payload', 400)
  }
  if (!validPayload(payload)) return relayError('Unsupported eMAFF query', 400)
  return relayFixedRequest(request, {
    target: 'https://map-internal.api.maff.go.jp/mobileapi/getBasicLayerGeometry',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://map.maff.go.jp',
      Referer: 'https://map.maff.go.jp/',
      Authorization: 'undefined',
      'User-Agent': 'Mozilla/5.0 SVGMap-compatible-host/1.0',
    },
    body,
    maximumResponseBytes: 30 * 1024 * 1024,
  })
}
