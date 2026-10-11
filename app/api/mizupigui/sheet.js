import { GoogleAuth } from 'google-auth-library'
import { HISTORY_HEADERS, LATEST_HEADERS, historyRow, latestRow, normalizePayload } from './normalize.js'

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets'
const ROOT = 'https://sheets.googleapis.com/v4/spreadsheets'
const MAX_LATEST_ROWS = 5000

function range(sheetName, cells) {
  return `'${sheetName.replaceAll("'", "''")}'!${cells}`
}

function assertHeaders(actual, expected, name) {
  if (actual?.length !== expected.length || expected.some((header, index) => actual[index] !== header)) {
    throw new Error(`Mizupigui ${name} sheet header does not match the configured schema`)
  }
}

async function sheetsClient(credentialsJson, injectedClient) {
  if (injectedClient) return injectedClient
  const credentials = JSON.parse(credentialsJson)
  if (credentials.type !== 'service_account' || !credentials.client_email || !credentials.private_key) {
    throw new Error('Invalid service account configuration')
  }
  return new GoogleAuth({ credentials, scopes: [SCOPE] }).getClient()
}

function sheetBoolean(value) {
  if (value === true || value === false) return value
  if (value === 'TRUE') return true
  if (value === 'FALSE') return false
  throw new Error('Invalid boolean in latest sheet')
}

function sheetNumberOrNull(value) {
  return value === '' || value == null ? null : Number(value)
}

export function normalizeLatestRows(values) {
  assertHeaders(values?.[0], LATEST_HEADERS, 'latest')
  const rows = values.slice(1)
  if (rows.length > MAX_LATEST_ROWS) throw new Error('Mizupigui latest sheet is too large')
  const ids = new Set()
  let updatedAt = null
  const stakes = rows.map((row) => {
    const stake = normalizePayload({
      id: row[0], name: row[1], lat: sheetNumberOrNull(row[2]), lng: sheetNumberOrNull(row[3]),
      waterLevel: sheetNumberOrNull(row[4]), tiltDetected: sheetBoolean(row[5]),
      batteryOk: sheetBoolean(row[6]), lastReceivedAt: row[7],
      floodedAt: row[8] || null, logId: row[9],
    })
    if (ids.has(stake.id)) throw new Error('Mizupigui latest sheet contains duplicate stake IDs')
    ids.add(stake.id)
    const receivedAt = row[10]
    if (typeof receivedAt !== 'string' || !Number.isFinite(Date.parse(receivedAt))) {
      throw new Error('Mizupigui latest sheet contains an invalid receivedAt')
    }
    if (!updatedAt || Date.parse(receivedAt) > Date.parse(updatedAt)) updatedAt = receivedAt
    const { logId, ...publicStake } = stake
    return publicStake
  })
  return { updatedAt, stakes }
}

export async function readLatestMizupigui({ spreadsheetId, latestSheetName, credentialsJson,
  client: injectedClient, signal }) {
  const client = await sheetsClient(credentialsJson, injectedClient)
  if (signal?.aborted) throw signal.reason
  const url = new URL(`${ROOT}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range(latestSheetName, 'A1:L'))}`)
  url.searchParams.set('valueRenderOption', 'UNFORMATTED_VALUE')
  const response = await client.request({ url: url.href, method: 'GET', signal })
  return normalizeLatestRows(response.data?.values)
}

export async function appendMizupiguiEvent({
  spreadsheetId, sheetName, latestSheetName, credentialsJson,
  stake, retryCount, client: injectedClient, signal,
}) {
  const client = await sheetsClient(credentialsJson, injectedClient)
  if (signal?.aborted) throw signal.reason

  const base = `${ROOT}/${encodeURIComponent(spreadsheetId)}/values`
  const requestedRanges = [
    range(sheetName, 'A1:L1'),
    range(sheetName, 'C2:C'),
    range(latestSheetName, 'A1:L1'),
    range(latestSheetName, 'A2:L'),
  ]
  const search = new URLSearchParams()
  for (const item of requestedRanges) search.append('ranges', item)
  const current = await client.request({ url: `${base}:batchGet?${search}`, method: 'GET', signal })
  const values = current.data?.valueRanges?.map((item) => item.values || [])
  if (!values || values.length !== requestedRanges.length) throw new Error('Google Sheets did not return the requested ranges')
  assertHeaders(values[0][0], HISTORY_HEADERS, 'history')
  assertHeaders(values[2][0], LATEST_HEADERS, 'latest')

  const duplicate = values[1].some((row) => String(row[0] ?? '') === stake.logId)
  const latestRows = values[3]
  const positions = latestRows.flatMap((row, index) => String(row[0] ?? '') === stake.id ? [index] : [])
  if (positions.length > 1) throw new Error('Mizupigui latest sheet contains duplicate stake IDs')
  const latestIndex = positions[0]
  const latest = latestIndex === undefined ? null : latestRows[latestIndex]
  if (latest && (!latest[7] || !Number.isFinite(Date.parse(latest[7])))) {
    throw new Error('Mizupigui latest sheet contains an invalid timestamp')
  }

  // Append history first. If the latest write later fails, a retry can repair
  // latest without adding the same logId to history again.
  const receivedAt = new Date().toISOString()
  if (!duplicate) {
    const appendUrl = `${base}/${encodeURIComponent(range(sheetName, 'A:L'))}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`
    const result = await client.request({
      url: appendUrl,
      method: 'POST',
      data: { majorDimension: 'ROWS', values: [historyRow(stake, retryCount, receivedAt)] },
      signal,
    })
    if (Number(result.data?.updates?.updatedRows) !== 1) {
      throw new Error('Google Sheets did not confirm the history append')
    }
  }

  const shouldUpdateLatest = !latest || Date.parse(stake.lastReceivedAt) > Date.parse(latest[7])
  if (shouldUpdateLatest) {
    const row = latestRow(stake, retryCount, receivedAt)
    if (latest) {
      const rowNumber = latestIndex + 2
      const updateUrl = `${base}/${encodeURIComponent(range(latestSheetName, `A${rowNumber}:L${rowNumber}`))}?valueInputOption=RAW`
      const result = await client.request({
        url: updateUrl,
        method: 'PUT',
        data: { majorDimension: 'ROWS', values: [row] },
        signal,
      })
      if (Number(result.data?.updatedRows) !== 1) throw new Error('Google Sheets did not confirm the latest update')
    } else {
      const appendUrl = `${base}/${encodeURIComponent(range(latestSheetName, 'A:L'))}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`
      const result = await client.request({
        url: appendUrl,
        method: 'POST',
        data: { majorDimension: 'ROWS', values: [row] },
        signal,
      })
      if (Number(result.data?.updates?.updatedRows) !== 1) {
        throw new Error('Google Sheets did not confirm the latest append')
      }
    }
  }
  return { inserted: duplicate ? 0 : 1, duplicates: duplicate ? 1 : 0, latestUpdated: shouldUpdateLatest }
}
