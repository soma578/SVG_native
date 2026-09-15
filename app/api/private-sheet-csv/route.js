import { GoogleAuth } from 'google-auth-library'
import { normalizeSheetValues, parseColumnMap, parseSpreadsheetId } from './normalize.js'
import { buildPrivateDriveImageUrl } from './drive-photo.js'
import { safeGoogleFailure, safeNormalizationFailure } from './diagnostics.js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_CSV_BYTES = 4_000_000 // Below Vercel's 4.5 MB Function response limit.
const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly'
const privateHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
}

export async function GET() {
  const spreadsheetId = parseSpreadsheetId(process.env.SVG3_PRIVATE_SHEET_ID)
  const range = process.env.SVG3_PRIVATE_SHEET_RANGE?.trim()
  const credentialsJson = process.env.SVG3_GOOGLE_SERVICE_ACCOUNT_JSON
  let columns
  try { columns = parseColumnMap(process.env.SVG3_PRIVATE_SHEET_COLUMNS) }
  catch { return new Response('Sheet column mapping is not configured', { status: 503, headers: privateHeaders }) }
  if (!spreadsheetId || !range || !credentialsJson) {
    return new Response('Private Sheet is not configured', { status: 503, headers: privateHeaders })
  }

  let credentials
  try {
    credentials = JSON.parse(credentialsJson)
    if (credentials.type !== 'service_account' || !credentials.client_email || !credentials.private_key) {
      throw new Error('Invalid service account')
    }
  } catch {
    return new Response('Sheet credentials are not configured', { status: 503, headers: privateHeaders })
  }

  let client
  try {
    const auth = new GoogleAuth({ credentials, scopes: [GOOGLE_SCOPE] })
    client = await auth.getClient()
  } catch {
    // Authentication errors can contain credential details; log the stage only.
    console.error('Private Sheet authentication failed')
    return new Response('Private Sheet is unavailable', { status: 502, headers: privateHeaders })
  }

  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`)
  url.searchParams.set('valueRenderOption', 'UNFORMATTED_VALUE')
  let response
  try {
    response = await client.request({ url: url.href, method: 'GET' })
  } catch (error) {
    console.error('Google Sheets GetValues failed', safeGoogleFailure(error, credentialsJson, credentials))
    return new Response('Private Sheet is unavailable', { status: 502, headers: privateHeaders })
  }

  let csv
  try {
    csv = normalizeSheetValues(response.data?.values, columns, {
      transformImageUrl: (raw) => buildPrivateDriveImageUrl(raw, credentials.private_key) || raw,
      onInvalidRow: ({ row, reason }) => {
        // Never log CSV cell contents or a private Sheet URL.
        console.warn('Private Sheet row skipped', { row, reason })
      },
    })
  } catch (error) {
    console.error('Private Sheet normalization failed', safeNormalizationFailure(error))
    return new Response('Private Sheet data is invalid', { status: 502, headers: privateHeaders })
  }
  if (Buffer.byteLength(csv, 'utf8') > MAX_CSV_BYTES) {
    return new Response('Sheet is too large for this delivery method', { status: 413, headers: privateHeaders })
  }
  return new Response(csv, {
    status: 200,
    headers: { ...privateHeaders, 'Content-Type': 'text/csv; charset=utf-8' },
  })
}
