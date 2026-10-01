import {
  SOURCE_ORIGIN,
  assertAllowedOutagePath,
  parseMunicipalityDetail,
  parsePrefecturePage,
} from './normalize.js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const PREFECTURE_PATH = '/LWC31133.html'
const CACHE_MILLISECONDS = 4 * 60 * 1000
const MAX_MUNICIPALITIES = 30
let memoryCache = null

const responseHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
}

async function fetchHtml(pathname) {
  assertAllowedOutagePath(pathname)
  const relayBase = process.env.CHUGOKU_OUTAGE_RELAY_URL?.trim()
  const directUrl = new URL(pathname, SOURCE_ORIGIN)
  const target = relayBase
    ? new URL(`?path=${encodeURIComponent(pathname)}`, relayBase)
    : directUrl
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12_000)
  try {
    const headers = {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'Okayama-University-SVGMap-Outage/1.0',
    }
    const relayToken = process.env.CHUGOKU_OUTAGE_RELAY_TOKEN?.trim()
    if (relayBase && relayToken) headers.Authorization = `Bearer ${relayToken}`
    const response = await fetch(target, {
      headers,
      cache: 'no-store',
      redirect: 'error',
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`${relayBase ? 'relay' : 'upstream'} HTTP ${response.status}`)
    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('text/html')) throw new Error(`Unexpected content type: ${contentType || 'none'}`)
    return response.text()
  } finally {
    clearTimeout(timer)
  }
}

async function collect() {
  const prefecture = parsePrefecturePage(await fetchHtml(PREFECTURE_PATH))
  if (prefecture.municipalityPaths.length > MAX_MUNICIPALITIES) {
    throw new Error(`Too many municipality detail links: ${prefecture.municipalityPaths.length}`)
  }
  const nested = await Promise.all(prefecture.municipalityPaths.map(async ({ path, municipalityCode }) =>
    parseMunicipalityDetail(await fetchHtml(path), municipalityCode)))
  return {
    schemaVersion: 1,
    region: { id: 'okayama', name: '岡山県' },
    source: `${SOURCE_ORIGIN}${PREFECTURE_PATH}`,
    sourceUpdatedAt: prefecture.updatedAt,
    fetchedAt: new Date().toISOString(),
    acquisition: process.env.CHUGOKU_OUTAGE_RELAY_URL ? 'relay' : 'direct',
    outages: nested.flat(),
    notices: [
      '停電戸数はおよそ5分間隔で更新され、確認状況により変更されます。',
      '工事停電、約5分以内の停電、引込線や建物内設備の故障等は含まれません。',
    ],
  }
}

export async function GET() {
  try {
    const now = Date.now()
    if (memoryCache && now - memoryCache.storedAt < CACHE_MILLISECONDS) {
      return Response.json({ ...memoryCache.value, cache: 'memory' }, { headers: responseHeaders })
    }
    const value = await collect()
    memoryCache = { storedAt: now, value }
    return Response.json({ ...value, cache: 'miss' }, { headers: responseHeaders })
  } catch (error) {
    console.error('[chugoku-outages]', error)
    if (memoryCache) {
      return Response.json({
        ...memoryCache.value,
        stale: true,
        warning: '最新情報を取得できないため、このサーバーが最後に取得した情報を表示しています。',
      }, { headers: responseHeaders })
    }
    return Response.json({
      error: '中国電力ネットワークの停電情報を取得できませんでした。',
      source: `${SOURCE_ORIGIN}${PREFECTURE_PATH}`,
    }, { status: 502, headers: responseHeaders })
  }
}
