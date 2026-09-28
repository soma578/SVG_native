import { noStoreHeaders, relayError, validateSameOriginRequest } from '../_lib/fixed-relay.js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(request) {
  try { validateSameOriginRequest(request) } catch (error) { return relayError(error.message, 403) }
  return Response.json({
    error: 'The legacy MSIL token API has been retired by the upstream service',
  }, { status: 410, headers: noStoreHeaders() })
}
