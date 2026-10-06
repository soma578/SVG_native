import assert from 'node:assert/strict'
import test from 'node:test'
import { handlePost } from './route.js'
import { normalizePayload, SHEET_HEADERS, sheetRow } from './normalize.js'
import { appendMizupiguiEvents } from './sheet.js'

const key = 'test-key-with-at-least-thirty-two-characters'
const stake = {
  id: 'A001', name: '1号杭', lat: 34.5231, lng: 133.6712,
  waterLevel: 1, tiltDetected: false, batteryOk: true,
  lastReceivedAt: '2026-09-10T08:47+09:00',
}
const options = { apiKey: key, spreadsheetId: 'test-spreadsheet-id', credentialsJson: '{}', persist: async () => ({ inserted: 1, duplicates: 0 }) }
const request = (value, apiKey = key, contentType = 'application/json') => new Request('https://example.test/api/mizupigui', {
  method: 'POST',
  headers: { 'Content-Type': contentType, 'X-API-Key': apiKey },
  body: JSON.stringify(value),
})

test('single stake and previous envelope format normalize to the same event', () => {
  const single = normalizePayload(stake)
  const batch = normalizePayload({ updatedAt: '2026-09-10T09:00+09:00', stakes: [stake, stake] })
  assert.deepEqual(single.stakes, batch.stakes)
  assert.equal(batch.stakes.length, 1)
  assert.equal(single.stakes[0].lastReceivedAt, '2026-09-09T23:47:00.000Z')
  assert.equal(batch.updatedAt, '2026-09-10T00:00:00.000Z')
})

test('nullable sensor fields and raw sheet rows preserve zero and false', () => {
  const normalized = normalizePayload({ ...stake, waterLevel: 0, tiltDetected: null })
  const row = sheetRow(normalized.stakes[0], '', '2026-09-10T00:00:00Z')
  assert.equal(SHEET_HEADERS.length, 10)
  assert.equal(row[5], 0)
  assert.equal(row[6], '')
  assert.equal(row[7], true)
})

test('rejects invalid coordinates, sensor values, and timestamps', () => {
  for (const changed of [
    { lat: '34.5' }, { lng: 181 }, { waterLevel: 3 },
    { tiltDetected: 'false' }, { batteryOk: null },
    { lastReceivedAt: '2026-09-10T08:47' },
  ]) assert.throws(() => normalizePayload({ ...stake, ...changed }))
})

test('authentication and content type are required before storage', async () => {
  assert.equal((await handlePost(request(stake, 'wrong'), options)).status, 401)
  assert.equal((await handlePost(request(stake, key, 'text/plain'), options)).status, 415)
})

test('2xx means storage confirmed; duplicate is 200; storage failure is retryable', async () => {
  const created = await handlePost(request(stake), options)
  assert.equal(created.status, 201)
  assert.equal(created.headers.get('Cache-Control'), 'private, no-store, max-age=0')
  const duplicate = await handlePost(request(stake), { ...options, persist: async () => ({ inserted: 0, duplicates: 1 }) })
  assert.equal(duplicate.status, 200)
  const failed = await handlePost(request(stake), { ...options, persist: async () => { throw new Error('private error') } })
  assert.equal(failed.status, 503)
  assert.doesNotMatch(await failed.text(), /private error/)
})

test('body limit and missing configuration fail closed', async () => {
  const huge = { ...stake, name: 'a'.repeat(70_000) }
  assert.equal((await handlePost(request(huge), options)).status, 400)
  assert.equal((await handlePost(request(stake), { ...options, apiKey: 'short' })).status, 503)
})

test('Sheets adapter skips existing event and confirms append before success', async () => {
  const { stakes } = normalizePayload({ stakes: [stake, { ...stake, id: 'A002' }] })
  const calls = []
  const client = {
    request: async (options) => {
      calls.push(options)
      return calls.length === 1
        ? { data: { values: [SHEET_HEADERS, sheetRow(stakes[0], '', '2026-09-10T00:00:00Z')] } }
        : { data: { updates: { updatedRows: 1 } } }
    },
  }
  const result = await appendMizupiguiEvents({ spreadsheetId: 'test-id', sheetName: 'history', stakes, updatedAt: '', client })
  assert.deepEqual(result, { inserted: 1, duplicates: 1 })
  assert.equal(calls[0].method, 'GET')
  assert.equal(calls[1].method, 'POST')
  assert.match(calls[1].url, /valueInputOption=RAW/)
  assert.equal(calls[1].data.values[0][1], 'A002')
})
