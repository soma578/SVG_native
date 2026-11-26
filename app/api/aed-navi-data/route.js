import snapshot from '../../../svgmapAppLayers/appLayers/aedNavi/data/okayama.json' with { type: 'json' }
import { MESHES, parseTile } from '../../../scripts/aed-navi-data.mjs'

export const dynamic = 'force-dynamic'

const HEADERS = {
  'Cache-Control': 'public, max-age=0, must-revalidate',
  'Vercel-CDN-Cache-Control': 'public, s-maxage=120',
}
const FALLBACK_HEADERS = {
  'Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
}
const known = new Map(snapshot.records.map((record) => [record.id, record]))
let cached = null
let loading = null

async function fetchLiveData(previous) {
  const versionResponse = await fetch(`https://aed-navi.jp/app.json?t=${Date.now()}`, {
    cache: 'no-store', signal: AbortSignal.timeout(8000), headers: { 'Accept-Encoding': 'gzip' },
  })
  if (!versionResponse.ok) throw new Error(`AED version HTTP ${versionResponse.status}`)
  const version = Number((await versionResponse.json()).map_version)
  if (!Number.isFinite(version)) throw new Error('AED version missing')
  if (previous?.mapVersion === String(version)) {
    return { ...previous, retrievedAt: new Date().toISOString() }
  }

  const tiles = await Promise.all(MESHES.map(async (mesh) => {
    const response = await fetch(`https://cdn.aed-navi.jp/data/map/open/${mesh}?v=${version}`, {
      cache: 'no-store', signal: AbortSignal.timeout(12000), headers: { 'Accept-Encoding': 'gzip' },
    })
    if (!response.ok) throw new Error(`AED mesh ${mesh} HTTP ${response.status}`)
    return parseTile(await response.text())
  }))
  const live = new Map(tiles.flat().map((record) => [record.id, record]))
  if (live.size < 100) throw new Error(`Only ${live.size} AEDs returned`)
  const records = [...known.values()].flatMap((saved) => {
    const current = live.get(saved.id)
    return current ? [{ ...saved, ...current }] : []
  })
  return {
    source: 'live', retrievedAt: new Date().toISOString(), mapVersion: String(version),
    scope: '岡山県', count: records.length, records,
  }
}

export async function GET() {
  try {
    if (!cached || Date.now() - cached.at > 120_000) {
      loading ||= fetchLiveData(cached?.data).then((data) => { cached = { at: Date.now(), data }; return data })
        .finally(() => { loading = null })
      await loading
    }
    return Response.json(cached.data, { headers: HEADERS })
  } catch (error) {
    console.error('[aed-navi-data]', error)
    return Response.json({
      ...snapshot, source: 'snapshot',
      warning: '公式データを現在取得できないため、保存済みデータを表示しています',
    }, { headers: FALLBACK_HEADERS })
  }
}
