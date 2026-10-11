import { GoogleAuth } from 'google-auth-library'
import { HISTORY_HEADERS, LATEST_HEADERS, historyRow, latestRow } from './normalize.js'

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets'
const ROOT = 'https://sheets.googleapis.com/v4/spreadsheets'

function range(sheetName, cells) {
  return `'${sheetName.replaceAll("'", "''")}'!${cells}`
}

function assertHeaders(actual, expected, name) {
  if (actual?.length !== expected.length || expected.some((header, index) => actual[index] !== header)) {
    throw new Error(`Mizupigui ${name} sheet header does not match the configured schema`)
  }
}

export async function appendMizupiguiEvent({
  spreadsheetId, sheetName, latestSheetName, credentialsJson,
  stake, retryCount, client: injectedClient, signal,
}) {
  let client = injectedClient
  if (!client) {
    const credentials = JSON.parse(credentialsJson)
    if (credentials.type !== 'service_account' || !credentials.client_email || !credentials.private_key) {
      throw new Error('Invalid service account configuration')
    }
    client = await new GoogleAuth({ credentials, scopes: [SCOPE] }).getClient()
  }
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
