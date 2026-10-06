import {
  SOURCE_ORIGIN,
  assertAllowedOutagePath,
  parseMunicipalityDetail,
  parsePrefecturePage,
  parseHistoryPage,
} from './normalize.js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const CURRENT_PATH = '/'
const HISTORY_PATH = '/LWC30040/index'
const CACHE_MILLISECONDS = 4 * 60 * 1000
const MAX_MUNICIPALITIES = 250
const CHUGOKU_PREFECTURE_CODES = new Set(['31', '32', '33', '34', '35'])
let memoryCache = null

const responseHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
}

async function fetchHtml(pathname) {
  const allowedPath = assertAllowedOutagePath(pathname)
  const relayBase = process.env.CHUGOKU_OUTAGE_RELAY_URL?.trim()
  const directUrl = new URL(allowedPath, SOURCE_ORIGIN)
  const target = relayBase
    ? new URL(`?path=${encodeURIComponent(allowedPath)}`, relayBase)
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
  const currentIndex = parsePrefecturePage(await fetchHtml(CURRENT_PATH))
  if (currentIndex.municipalityPaths.length > MAX_MUNICIPALITIES) {
    throw new Error(`Too many municipality detail links: ${currentIndex.municipalityPaths.length}`)
  }
  const currentNested = await Promise.all(currentIndex.municipalityPaths.map(async ({ path, municipalityCode }) =>
    parseMunicipalityDetail(await fetchHtml(path), municipalityCode)))
  const historyDates = Array.from({ length: 8 }, (_, offset) => {
    const jst = new Date(Date.now() + 9 * 60 * 60 * 1000 - offset * 24 * 60 * 60 * 1000)
    return `${jst.getUTCFullYear()}${String(jst.getUTCMonth() + 1).padStart(2, '0')}${String(jst.getUTCDate()).padStart(2, '0')}`
  })
  const historyPages = await Promise.all(historyDates.flatMap((date) => [
    fetchHtml(`${HISTORY_PATH}?date=${date}`).then((html) => parseHistoryPage(html, 'standard')),
    fetchHtml(`${HISTORY_PATH}?date=${date}&type=s`).then((html) => parseHistoryPage(html, 'short')),
  ]))
  const history = [...new Map(historyPages.flatMap((page) => page.outages)
    .filter((outage) => CHUGOKU_PREFECTURE_CODES.has(outage.prefectureCode))
    .map((outage) => [outage.id, outage])).values()]
  const current = currentNested.flat()
  return {
    schemaVersion: 2,
    region: { id: 'chugoku', name: '中国地方', prefectureCodes: [...CHUGOKU_PREFECTURE_CODES] },
    source: SOURCE_ORIGIN,
    historySource: `${SOURCE_ORIGIN}/LWC30040`,
    sourceUpdatedAt: currentIndex.updatedAt,
    fetchedAt: new Date().toISOString(),
    acquisition: process.env.CHUGOKU_OUTAGE_RELAY_URL ? 'relay' : 'direct',
    historyAvailableDays: 7,
    current,
    history,
    outages: [...current, ...history],
    notices: [
      '停電戸数はおよそ5分間隔で更新され、確認状況により変更されます。',
      '履歴は公式サイトが公開する過去1週間分です。5分未満で自動復旧した停電も履歴に含みます。',
      '工事停電、引込線や建物内設備の故障等は含まれません。',
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
      source: SOURCE_ORIGIN,
    }, { status: 502, headers: responseHeaders })
  }
}
