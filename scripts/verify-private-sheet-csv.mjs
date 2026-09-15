import assert from 'node:assert/strict'
import { normalizeSheetValues, parseColumnMap, parseSpreadsheetId } from '../app/api/private-sheet-csv/normalize.js'
import { GET } from '../app/api/private-sheet-csv/route.js'
import { buildPrivateDriveImageUrl, parseDrivePhotoUrl, verifyPrivateDriveImageRequest } from '../app/api/private-sheet-csv/drive-photo.js'
import { GET as GET_IMAGE } from '../app/api/private-sheet-image/route.js'

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
assert.throws(() => normalizeSheetValues([['x', 'not-lat', 133, '地点A']], map))

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

if (!process.env.SVG3_GOOGLE_SERVICE_ACCOUNT_JSON) {
  const response = await GET()
  assert.equal(response.status, 503)
  assert.match(response.headers.get('cache-control'), /no-store/)
  const imageResponse = await GET_IMAGE(new Request('https://map.example.com/api/private-sheet-image?id=ABC123&sig=invalid'))
  assert.equal(imageResponse.status, 503)
}

console.log('[private-sheet-csv] exact Sheet columns, descriptions, signed Drive photos, URL guards, CSV escaping, and missing-config guard passed')
