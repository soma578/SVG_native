import assert from 'node:assert/strict'
import { normalizeSheetValues, parseColumnMap, parseSpreadsheetId } from '../app/api/private-sheet-csv/normalize.js'
import { GET } from '../app/api/private-sheet-csv/route.js'
import { buildPrivateDriveImageUrl, parseDrivePhotoUrl, verifyPrivateDriveImageRequest } from '../app/api/private-sheet-csv/drive-photo.js'
import { GET as GET_IMAGE } from '../app/api/private-sheet-image/route.js'
import { safeGoogleFailure, safeNormalizationFailure } from '../app/api/private-sheet-csv/diagnostics.js'
import { GoogleAuth } from 'google-auth-library'

const map = parseColumnMap('{"id":0,"title":3,"lat":1,"lon":2,"imageUrl":5,"description":4}')
const csv = normalizeSheetValues([
  ['001', 34.6651, 133.918, '地点A', '説明,一行目', 'https://example.com/photo.jpg'],
  [],
  ['002', 34.67, 133.92, '地点B', '', ''],
], map)
assert.equal(csv.split('\n')[0], 'id,title,lat,lon,imageUrl,description')
assert(csv.includes('001,地点A,34.6651,133.918,https://example.com/photo.jpg,"説明,一行目"'))
assert(csv.includes('002,地点B,34.67,133.92,,'))
assert.equal(csv.split('\n').filter(Boolean).length, 3)

assert.equal(parseSpreadsheetId('https://docs.google.com/spreadsheets/d/ABC_123/edit?usp=sharing'), 'ABC_123')
assert.equal(parseSpreadsheetId('ABC_123'), 'ABC_123')
assert.equal(parseSpreadsheetId('https://docs.google.com.example.com/spreadsheets/d/ABC_123/edit'), null)
assert.throws(() => parseColumnMap('{"title":1,"lat":-1,"lon":2}'))
assert.equal(normalizeSheetValues(undefined, map), 'id,title,lat,lon,imageUrl,description\n')
const skippedRows = []
const partialCsv = normalizeSheetValues([
  ['003', 34.7, 133.9, ''],
  ['004', '', 133.9, '地点C'],
  ['005', 91, 133.9, '地点D'],
  ['006', 34.5, 133.7, '地点E'],
], map, { onInvalidRow: (detail) => skippedRows.push(detail) })
assert.deepEqual(skippedRows, [
  { row: 1, reason: 'missing_title' },
  { row: 2, reason: 'missing_coordinates' },
  { row: 3, reason: 'invalid_coordinates' },
])
assert(partialCsv.includes('006,地点E,34.5,133.7,,'))
assert(!partialCsv.includes('003,'))
assert(!partialCsv.includes('004,'))
assert(!partialCsv.includes('005,'))

const currentSheetMap = parseColumnMap('{"id":0,"title":2,"lat":7,"lon":8,"imageUrl":10,"descriptionColumns":[3,4,5,6]}')
const sourcePhoto = 'https://drive.google.com/file/d/ABC123/view?usp=sharing&resourcekey=KEY_123'
const signingKey = 'test-only-secret'
const privateImage = buildPrivateDriveImageUrl(sourcePhoto, signingKey)
const privateUrl = new URL(privateImage, 'https://map.example.com')
assert.equal(privateUrl.pathname, '/api/private-sheet-image')
assert.equal(privateUrl.searchParams.get('source'), sourcePhoto)
assert.equal(privateUrl.searchParams.get('resourcekey'), 'KEY_123')
assert(verifyPrivateDriveImageRequest('ABC123', 'KEY_123', privateUrl.searchParams.get('sig'), signingKey))
assert(!verifyPrivateDriveImageRequest('OTHER', 'KEY_123', privateUrl.searchParams.get('sig'), signingKey))
assert.equal(parseDrivePhotoUrl('https://drive.google.com/open?id=ABC123').fileId, 'ABC123')
assert.equal(parseDrivePhotoUrl('https://drive.google.com.example.com/file/d/ABC123/view'), null)
assert.equal(parseDrivePhotoUrl('javascript:alert(1)'), null)
assert.equal(parseDrivePhotoUrl('data:text/html,hello'), null)
const currentCsv = normalizeSheetValues([
  ['001', '2026-09-15', '地点A', '説明1', '', '説明,3', '<script>alert(1)</script>', 34.6651, 133.918, 5, sourcePhoto],
  ['002', '', '地点B', '', '', '', '', 34.67, 133.92, '', 'https://example.com/test.jpg'],
], currentSheetMap, { transformImageUrl: (raw) => buildPrivateDriveImageUrl(raw, signingKey) || raw })
assert(currentCsv.includes('001,地点A,34.6651,133.918,/api/private-sheet-image?'))
assert(currentCsv.includes('"item2: 説明1\nitem4: 説明,3\nitem5: <script>alert(1)</script>"'))
assert(currentCsv.includes('002,地点B,34.67,133.92,https://example.com/test.jpg,'))
assert(!currentCsv.includes('2026-09-15'))
assert.throws(() => parseColumnMap('{"title":2,"lat":7,"lon":8,"descriptionColumns":[3,-1,5,6]}'))

const fakeCredentials = {
  client_email: 'secret@example.com',
  private_key: '-----BEGIN PRIVATE KEY-----\nTEST_SECRET\n-----END PRIVATE KEY-----',
}
const fakeCredentialsJson = JSON.stringify(fakeCredentials)
const diagnostic = safeGoogleFailure({ response: {
  status: 403,
  data: { error: {
    status: 'PERMISSION_DENIED',
    message: `The caller does not have permission. Bearer ya29.TEST_TOKEN ${fakeCredentials.client_email} ${fakeCredentials.private_key}`,
  } },
} }, fakeCredentialsJson, fakeCredentials)
assert.equal(diagnostic.httpStatus, 403)
assert.equal(diagnostic.googleStatus, 'PERMISSION_DENIED')
assert.match(diagnostic.googleMessage, /The caller does not have permission/)
assert(!JSON.stringify(diagnostic).includes('TEST_SECRET'))
assert(!JSON.stringify(diagnostic).includes('TEST_TOKEN'))
assert(!JSON.stringify(diagnostic).includes(fakeCredentials.client_email))
const escapedDiagnostic = safeGoogleFailure({ response: {
  status: 400,
  data: { error: { status: 'INVALID_ARGUMENT', message: JSON.stringify(fakeCredentials.private_key) } },
} }, fakeCredentialsJson, fakeCredentials)
assert(!JSON.stringify(escapedDiagnostic).includes('TEST_SECRET'))
assert.equal(safeNormalizationFailure(new Error('Missing title or invalid coordinates at row 12')),
  'Missing title or invalid coordinates at row 12')
assert.equal(safeNormalizationFailure(new Error('https://private.example.com/secret')),
  'Unexpected CSV normalization error')

// A signed /view photo still renders when Drive API access is unavailable but
// the photo itself is link-shared. Stub the Google and thumbnail transports so
// this regression check never needs a real service account or a real photo.
const originalCredentialsJson = process.env.SVG3_GOOGLE_SERVICE_ACCOUNT_JSON
const originalGetClient = GoogleAuth.prototype.getClient
const originalFetch = globalThis.fetch
const originalWarn = console.warn
const originalError = console.error
try {
  process.env.SVG3_GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({
    type: 'service_account', client_email: 'photo-test@example.com', private_key: signingKey,
  })
  GoogleAuth.prototype.getClient = async () => { throw new Error('Drive API unavailable in test') }
  const requestedHosts = []
  globalThis.fetch = async (url) => {
    const host = new URL(url).hostname
    requestedHosts.push(host)
    if (host === 'drive.google.com') return new Response(null, {
      status: 302,
      headers: { Location: 'https://lh3.googleusercontent.com/d/ABC123=w1600' },
    })
    if (host === 'lh3.googleusercontent.com') return new Response(
      Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]),
      { headers: { 'Content-Type': 'image/jpeg' } },
    )
    throw new Error('Untrusted thumbnail host was fetched')
  }
  console.warn = () => {}
  console.error = () => {}
  const imageResponse = await GET_IMAGE(new Request(privateUrl.href))
  assert.equal(imageResponse.status, 200)
  assert.equal(imageResponse.headers.get('content-type'), 'image/jpeg')
  assert.deepEqual(requestedHosts, ['drive.google.com', 'lh3.googleusercontent.com'])
  assert.equal((await imageResponse.arrayBuffer()).byteLength, 4)

  globalThis.fetch = async (url) => {
    requestedHosts.push(new URL(url).hostname)
    return new Response(null, { status: 302, headers: { Location: 'https://attacker.example/photo.jpg' } })
  }
  const failedResponse = await GET_IMAGE(new Request(privateUrl.href))
  assert.equal(failedResponse.status, 502)
  assert(!requestedHosts.includes('attacker.example'))
} finally {
  if (originalCredentialsJson === undefined) delete process.env.SVG3_GOOGLE_SERVICE_ACCOUNT_JSON
  else process.env.SVG3_GOOGLE_SERVICE_ACCOUNT_JSON = originalCredentialsJson
  GoogleAuth.prototype.getClient = originalGetClient
  globalThis.fetch = originalFetch
  console.warn = originalWarn
  console.error = originalError
}

if (!process.env.SVG3_GOOGLE_SERVICE_ACCOUNT_JSON) {
  const response = await GET()
  assert.equal(response.status, 503)
  assert.match(response.headers.get('cache-control'), /no-store/)
  const imageResponse = await GET_IMAGE(new Request('https://map.example.com/api/private-sheet-image?id=ABC123&sig=invalid'))
  assert.equal(imageResponse.status, 503)
}

console.log('[private-sheet-csv] exact Sheet columns, invalid-row skipping, signed Drive photos with shared fallback, CSV escaping, and safe diagnostics passed')
