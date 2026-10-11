#!/usr/bin/env node
import { randomUUID } from 'node:crypto'

const endpoint = process.env.MIZUPIGUI_TEST_URL
const apiKey = process.env.MIZUPIGUI_TEST_KEY
if (!endpoint || !/^https:\/\//.test(endpoint) || !apiKey) {
  console.error('Set MIZUPIGUI_TEST_URL (HTTPS) and MIZUPIGUI_TEST_KEY before running this live write test.')
  process.exit(2)
}

const suffix = randomUUID().slice(0, 8)
const nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 19) + '+09:00'
const stake = {
  logId: `live-test-${suffix}`, id: `TEST-${suffix}`, name: '疎通試験用杭',
  lat: 34.5231, lng: 133.6712, waterLevel: 0, tiltDetected: false,
  batteryOk: true, lastReceivedAt: nowJst, floodedAt: null,
}
let writeAttempted = false

async function post(retryCount) {
  writeAttempted = true
  const response = await fetch(endpoint, {
    method: 'POST', cache: 'no-store',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey,
      'X-Logpot-Retry-Count': String(retryCount) },
    body: JSON.stringify(stake),
  })
  const body = await response.json()
  return { status: response.status, body }
}

try {
  const preflight = await fetch(endpoint, { cache: 'no-store' })
  if (!preflight.ok) {
    throw new Error(`Read endpoint is not ready: HTTP ${preflight.status}. Deploy the new API before writing a test row.`)
  }
  const current = await preflight.json()
  if (!Array.isArray(current.stakes)) {
    throw new Error('Read endpoint did not return the expected latest-sheet format; no test row was written.')
  }
  const first = await post(0)
  if (first.status !== 201 || first.body.inserted !== 1) {
    throw new Error(`First write was not confirmed: HTTP ${first.status} ${JSON.stringify(first.body)}`)
  }
  const retry = await post(1)
  if (retry.status !== 200 || retry.body.duplicates !== 1) {
    throw new Error(`Duplicate retry was not confirmed: HTTP ${retry.status} ${JSON.stringify(retry.body)}`)
  }
  const response = await fetch(endpoint, { cache: 'no-store' })
  const latest = await response.json()
  if (!response.ok || !latest.stakes?.some((item) => item.id === stake.id)) {
    throw new Error(`Latest read did not contain ${stake.id}: HTTP ${response.status}`)
  }
  console.log(`PASS ${stake.id}: history insert=1, duplicate retry=1, latest read=visible`)
  console.log('The TEST row remains in history and latest. Remove it from both tabs after checking the Sheet.')
} catch (error) {
  console.error(`FAIL ${stake.id}: ${error.message}`)
  if (writeAttempted) {
    console.error('A POST may already have written to the Sheet; inspect both tabs before retrying.')
  }
  process.exitCode = 1
}
