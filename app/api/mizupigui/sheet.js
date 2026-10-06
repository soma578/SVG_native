import { GoogleAuth } from 'google-auth-library'
import { eventKey, SHEET_HEADERS, sheetRow } from './normalize.js'

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets'

export async function appendMizupiguiEvents({ spreadsheetId, sheetName, credentialsJson, stakes, updatedAt, client: injectedClient }) {
  let client = injectedClient
  if (!client) {
    const credentials = JSON.parse(credentialsJson)
    if (credentials.type !== 'service_account' || !credentials.client_email || !credentials.private_key) {
      throw new Error('Invalid service account configuration')
    }
    client = await new GoogleAuth({ credentials, scopes: [SCOPE] }).getClient()
  }
  const range = `'${sheetName.replaceAll("'", "''")}'!A:J`
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`
  const current = await client.request({ url: base, method: 'GET' })
  const rows = current.data?.values || []
  if (SHEET_HEADERS.some((header, index) => rows[0]?.[index] !== header)) {
    throw new Error('Mizupigui sheet header does not match the configured schema')
  }
  const existing = new Set(rows.slice(1).filter((row) => row[1] && row[8]).map((row) => eventKey({ id: String(row[1]), lastReceivedAt: String(row[8]) })))
  const fresh = stakes.filter((stake) => !existing.has(eventKey(stake)))
  if (!fresh.length) return { inserted: 0, duplicates: stakes.length }
  const receivedAt = new Date().toISOString()
  const appendUrl = `${base}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`
  const result = await client.request({
    url: appendUrl,
    method: 'POST',
    data: { majorDimension: 'ROWS', values: fresh.map((stake) => sheetRow(stake, updatedAt, receivedAt)) },
  })
  if (Number(result.data?.updates?.updatedRows) !== fresh.length) {
    throw new Error('Google Sheets did not confirm all appended rows')
  }
  return { inserted: fresh.length, duplicates: stakes.length - fresh.length }
}
