import assert from 'node:assert/strict'
import test from 'node:test'
import { handlePost, handleGet } from './route.js'
import { HISTORY_HEADERS, LATEST_HEADERS, historyRow, latestRow, normalizePayload } from './normalize.js'
import { appendMizupiguiEvent, normalizeLatestRows, readLatestMizupigui } from './sheet.js'

const key = 'test-key-with-at-least-thirty-two-characters'
const stake = {
  logId: 'log-001', id: 'A001', name: '1号杭', lat: 34.5231, lng: 133.6712,
  waterLevel: 1, tiltDetected: false, batteryOk: true,
  lastReceivedAt: '2026-09-10T08:47:00+09:00', floodedAt: null,
}
const options = {
  apiKey: key, spreadsheetId: 'test-spreadsheet-id', credentialsJson: '{}',
  persist: async () => ({ inserted: 1, duplicates: 0, latestUpdated: true }),
}
const request = (value, { apiKey = key, contentType = 'application/json', retryCount = '0' } = {}) => {
  const headers = { 'Content-Type': contentType, 'X-API-Key': apiKey }
  if (retryCount !== null) headers['X-Logpot-Retry-Count'] = retryCount
  return new Request('https://example.test/api/mizupigui', {
    method: 'POST', headers, body: JSON.stringify(value),
  })
}

function fakeSheets() {
  const history = [HISTORY_HEADERS]
  const latest = [LATEST_HEADERS]
  const calls = []
  let failLatestOnce = false
  const client = {
    request: async (operation) => {
      calls.push(operation)
      assert.ok(operation.signal, 'all Sheets requests must be abortable')
      const url = decodeURIComponent(operation.url)
      if (operation.method === 'GET') {
        if (!url.includes(':batchGet') && url.includes("'latest'!A1:L")) return { data: { values: latest } }
        return { data: { valueRanges: [
          { values: [history[0]] },
          { values: history.slice(1).map((row) => [row[2]]) },
          { values: [latest[0]] },
          { values: latest.slice(1) },
        ] } }
      }
      if (url.includes("'history'!A:L") && operation.method === 'POST') {
        history.push(operation.data.values[0])
        return { data: { updates: { updatedRows: 1 } } }
      }
      if (url.includes("'latest'!") && failLatestOnce) {
        failLatestOnce = false
        throw new Error('latest write failed')
      }
      if (url.includes("'latest'!A:L") && operation.method === 'POST') {
        latest.push(operation.data.values[0])
        return { data: { updates: { updatedRows: 1 } } }
      }
      const match = url.match(/'latest'!A(\d+):L\d+/)
      if (match && operation.method === 'PUT') {
        latest[Number(match[1]) - 1] = operation.data.values[0]
        return { data: { updatedRows: 1 } }
      }
      throw new Error(`Unexpected Sheets request: ${operation.method} ${url}`)
    },
  }
  return { history, latest, calls, client, failNextLatest: () => { failLatestOnce = true } }
}

const sheetOptions = (client, incoming = stake, retryCount = 0) => ({
  spreadsheetId: 'test-id', sheetName: 'history', latestSheetName: 'latest',
  stake: normalizePayload(incoming), retryCount, client, signal: new AbortController().signal,
})

test('one event uses the OpenAPI fields and preserves nullable cells', () => {
  const normalized = normalizePayload({ ...stake, lat: null, lng: null, waterLevel: 0,
    floodedAt: '2026-09-10T08:40:00+09:00' })
  assert.equal(normalized.logId, 'log-001')
  assert.equal(normalized.lat, null)
  assert.equal(normalized.floodedAt, '2026-09-10T08:40:00+09:00')
  const history = historyRow(normalized, 2, '2026-09-10T00:00:00Z')
  const latest = latestRow(normalized, 2, '2026-09-10T00:00:00Z')
  assert.equal(HISTORY_HEADERS.length, 12)
  assert.equal(LATEST_HEADERS.length, 12)
  assert.deepEqual(history.slice(5, 10), ['', '', 0, false, true])
  assert.deepEqual(latest.slice(2, 7), ['', '', 0, false, true])
})

test('batch, missing fields, invalid timestamps and sensor values are rejected', () => {
  const invalid = [
    { logId: undefined }, { logId: '' }, { lat: '34.5' }, { lng: 181 },
    { waterLevel: 3 }, { tiltDetected: null }, { batteryOk: null },
    { floodedAt: undefined }, { lastReceivedAt: '2026-09-10T08:47+09:00' },
    { lastReceivedAt: '2026-02-30T08:47:00+09:00' },
  ]
  for (const changed of invalid) assert.throws(() => normalizePayload({ ...stake, ...changed }))
  assert.throws(() => normalizePayload({ stakes: [stake] }))
  assert.throws(() => normalizePayload([stake]))
})

test('authentication, content type and retry count are checked before storage', async () => {
  assert.equal((await handlePost(request(stake, { apiKey: 'wrong' }), options)).status, 401)
  assert.equal((await handlePost(request(stake, { contentType: 'text/plain' }), options)).status, 415)
  for (const retryCount of [null, '-1', '5', '1.0', '0, 1', '']) {
    assert.equal((await handlePost(request(stake, { retryCount }), options)).status, 400)
  }
  const seen = []
  const response = await handlePost(request(stake, { retryCount: '4' }), {
    ...options, persist: async (input) => { seen.push(input); return { inserted: 1, duplicates: 0 } },
  })
  assert.equal(response.status, 201)
  assert.equal(seen[0].retryCount, 4)
  assert.equal(seen[0].latestSheetName, 'latest')
})

test('2xx follows storage confirmation; failures and timeout return retryable 503', async () => {
  const created = await handlePost(request(stake), options)
  assert.equal(created.status, 201)
  assert.equal(created.headers.get('Cache-Control'), 'private, no-store, max-age=0')
  const duplicate = await handlePost(request(stake), { ...options,
    persist: async () => ({ inserted: 0, duplicates: 1, latestUpdated: false }) })
  assert.equal(duplicate.status, 200)
  const failed = await handlePost(request(stake), { ...options,
    persist: async () => { throw new Error('private error') } })
  assert.equal(failed.status, 503)
  assert.doesNotMatch(await failed.text(), /private error/)
  let aborted = false
  const timedOut = await handlePost(request(stake), { ...options, storageTimeoutMs: 15,
    persist: ({ signal }) => new Promise(() => signal.addEventListener('abort', () => { aborted = true })) })
  assert.equal(timedOut.status, 503)
  assert.equal(aborted, true)
})

test('body limit and missing configuration fail closed', async () => {
  assert.equal((await handlePost(request({ ...stake, name: 'a'.repeat(70_000) }), options)).status, 400)
  assert.equal((await handlePost(request(stake), { ...options, apiKey: 'short' })).status, 503)
  assert.equal((await handlePost(request(stake), { ...options, latestSheetName: 'history' })).status, 503)
})

test('history deduplicates by logId and latest only advances by lastReceivedAt', async () => {
  const sheets = fakeSheets()
  const first = await appendMizupiguiEvent(sheetOptions(sheets.client))
  assert.deepEqual(first, { inserted: 1, duplicates: 0, latestUpdated: true })
  assert.equal(sheets.history.length, 2)
  assert.equal(sheets.latest.length, 2)
  const retry = await appendMizupiguiEvent(sheetOptions(sheets.client, stake, 1))
  assert.deepEqual(retry, { inserted: 0, duplicates: 1, latestUpdated: false })
  const oldEvent = { ...stake, logId: 'log-older', lastReceivedAt: '2026-09-10T08:40:00+09:00' }
  const old = await appendMizupiguiEvent(sheetOptions(sheets.client, oldEvent))
  assert.deepEqual(old, { inserted: 1, duplicates: 0, latestUpdated: false })
  const newEvent = { ...stake, logId: 'log-newer', lastReceivedAt: '2026-09-10T08:50:00+09:00' }
  const newer = await appendMizupiguiEvent(sheetOptions(sheets.client, newEvent))
  assert.deepEqual(newer, { inserted: 1, duplicates: 0, latestUpdated: true })
  assert.equal(sheets.history.length, 4)
  assert.equal(sheets.latest.length, 2)
  assert.equal(sheets.latest[1][7], newEvent.lastReceivedAt)
  assert.equal(sheets.latest[1][9], newEvent.logId)
})

test('retry repairs latest after history succeeded but latest write failed', async () => {
  const sheets = fakeSheets()
  sheets.failNextLatest()
  await assert.rejects(appendMizupiguiEvent(sheetOptions(sheets.client)), /latest write failed/)
  assert.equal(sheets.history.length, 2)
  assert.equal(sheets.latest.length, 1)
  const repaired = await appendMizupiguiEvent(sheetOptions(sheets.client, stake, 1))
  assert.deepEqual(repaired, { inserted: 0, duplicates: 1, latestUpdated: true })
  assert.equal(sheets.history.length, 2)
  assert.equal(sheets.latest.length, 2)
})

test('mismatched Sheet headers and duplicate latest IDs stop writes', async () => {
  const sheets = fakeSheets()
  sheets.history[0] = ['old', ...HISTORY_HEADERS.slice(1)]
  await assert.rejects(appendMizupiguiEvent(sheetOptions(sheets.client)), /history sheet header/)
  assert.equal(sheets.calls.length, 1)
  sheets.history[0] = HISTORY_HEADERS
  sheets.latest.push(latestRow(stake, 0, '2026-09-10T00:00:00Z'))
  sheets.latest.push(latestRow(stake, 0, '2026-09-10T00:00:00Z'))
  await assert.rejects(appendMizupiguiEvent(sheetOptions(sheets.client)), /duplicate stake IDs/)
})

test('public latest read exposes only map fields and preserves null and false', async () => {
  const sheets = fakeSheets()
  await appendMizupiguiEvent(sheetOptions(sheets.client, { ...stake, lat: null, lng: null,
    waterLevel: null, tiltDetected: false }))
  const result = await readLatestMizupigui({ spreadsheetId: 'test-id', latestSheetName: 'latest',
    client: sheets.client, signal: new AbortController().signal })
  assert.equal(result.stakes.length, 1)
  assert.equal(result.stakes[0].lat, null)
  assert.equal(result.stakes[0].waterLevel, null)
  assert.equal(result.stakes[0].tiltDetected, false)
  assert.equal(result.stakes[0].batteryOk, true)
  assert.ok(result.updatedAt)
  assert.equal(Object.hasOwn(result.stakes[0], 'logId'), false)
  assert.equal(sheets.calls.at(-1).method, 'GET')
  assert.match(sheets.calls.at(-1).url, /valueRenderOption=UNFORMATTED_VALUE/)
  assert.throws(() => normalizeLatestRows([['bad'], sheets.latest[1]]), /sheet header/)
  assert.throws(() => normalizeLatestRows([LATEST_HEADERS, sheets.latest[1], sheets.latest[1]]), /duplicate stake IDs/)
})

test('GET latest needs no API key, is never cached, and fails closed', async () => {
  const getOptions = { spreadsheetId: 'test-spreadsheet-id', latestSheetName: 'latest', credentialsJson: '{}',
    read: async () => ({ updatedAt: null, stakes: [] }) }
  const request = new Request('https://example.test/api/mizupigui')
  const response = await handleGet(request, getOptions)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { updatedAt: null, stakes: [] })
  assert.match(response.headers.get('Cache-Control'), /no-store/)
  assert.equal((await handleGet(request, { ...getOptions, spreadsheetId: '' })).status, 503)
  assert.equal((await handleGet(request, { ...getOptions, read: async () => { throw new Error('private') } })).status, 503)
})
