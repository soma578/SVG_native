import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MESHES, inOkayama, loadOkayamaBoundary, parseTile } from './aed-navi-data.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const output = path.join(root, 'svgmapAppLayers/appLayers/aedNavi/data/okayama.json')
const DETAIL_FIELDS = [
  'name', 'address', 'placeNotes', 'placeTypeName', 'sourceName', 'notes',
  'confirmName', 'availName', 'availInfo', 'alwaysAvailName', 'availNotes',
  'images', 'updatedAt', 'detailCheckedAt',
]

function imageUrls(raw) {
  return String(raw || '').split(',').filter((name) =>
    /^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:jpe?g|png|webp)$/i.test(name))
    .map((name) => `https://aed-navi.jp/files/share/${name.split('/').map(encodeURIComponent).join('/')}`)
}

async function addPlaceDetails(records) {
  const previous = fs.existsSync(output) ? JSON.parse(fs.readFileSync(output, 'utf8')) : null
  const previousById = new Map((previous?.records || []).map((record) => [record.id, record]))
  for (const record of records) {
    const prior = previousById.get(record.id) || {}
    for (const field of DETAIL_FIELDS) if (prior[field] != null) record[field] = prior[field]
  }
  const missing = records.filter((record) => !record.detailCheckedAt ||
    Date.now() - Date.parse(record.detailCheckedAt) > 24 * 60 * 60 * 1000)
  for (let offset = 0; offset < missing.length; offset += 50) {
    const batch = missing.slice(offset, offset + 50)
    const form = new URLSearchParams({ latitude: '34.65', longitude: '133.90', request: '0' })
    batch.forEach((record, index) => form.append(`id[${index}]`, String(record.id)))
    try {
      const response = await fetch('https://aed-navi.jp/aed/infolist', {
        method: 'POST', body: form, signal: AbortSignal.timeout(15000),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', Accept: 'application/json' },
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const details = await response.json()
      const detailsById = new Map((Array.isArray(details) ? details : []).map((detail) => [Number(detail.id), detail]))
      for (const record of batch) {
        const detail = detailsById.get(record.id)
        if (!detail) continue
        record.name = String(detail?.place_name || '')
        record.address = String(detail?.place_address || '')
        record.placeNotes = String(detail.place_notes || '')
        record.placeTypeName = String(detail.place_type_name || '')
        record.sourceName = String(detail.source_name || '')
        record.notes = String(detail.notes || '')
        record.confirmName = String(detail.confirm_name || '')
        record.availName = String(detail.avail_name || '')
        record.availInfo = String(detail.avail_info || '')
        record.alwaysAvailName = String(detail.always_avail_name || '')
        record.availNotes = String(detail.avail_notes || '')
        record.images = imageUrls(detail.imagelist)
        record.updatedAt = String(detail.updated_at || '')
        record.detailCheckedAt = new Date().toISOString()
      }
    } catch (error) {
      console.warn(`[aed-navi] detail batch ${offset / 50 + 1} unavailable: ${error.message}`)
    }
  }
}

const versionResponse = await fetch(`https://aed-navi.jp/app.json?aed-import=${Date.now()}`, {
  cache: 'no-store', signal: AbortSignal.timeout(10000), headers: { 'Accept-Encoding': 'gzip' },
})
if (!versionResponse.ok) throw new Error(`AED N@VI version HTTP ${versionResponse.status}`)
const { map_version: version } = await versionResponse.json()
if (!Number.isFinite(Number(version))) throw new Error('AED N@VI map version missing')
const tiles = await Promise.all(MESHES.map(async (mesh) => {
  const response = await fetch(`https://cdn.aed-navi.jp/data/map/open/${mesh}?v=${version}`, {
    cache: 'no-store', signal: AbortSignal.timeout(15000), headers: { 'Accept-Encoding': 'gzip' },
  })
  if (!response.ok) throw new Error(`AED N@VI mesh ${mesh} HTTP ${response.status}`)
  return { mesh, text: await response.text() }
}))

const rings = loadOkayamaBoundary(root)
const byId = new Map()
for (const tile of tiles) {
  for (const record of parseTile(tile.text)) {
    if (inOkayama(record.lat, record.lng, rings)) byId.set(record.id, record)
  }
}
if (byId.size < 100) throw new Error(`Only ${byId.size} Okayama AEDs found; keeping the previous snapshot`)
const records = [...byId.values()].sort((a, b) => a.id - b.id)
await addPlaceDetails(records)
const snapshot = {
  source: 'AED N@VI', sourceUrl: 'https://aed-navi.jp/map',
  retrievedAt: new Date().toISOString(), mapVersion: String(version),
  scope: '岡山県', count: byId.size,
  records,
}
fs.mkdirSync(path.dirname(output), { recursive: true })
const temp = `${output}.tmp`
fs.writeFileSync(temp, `${JSON.stringify(snapshot)}\n`)
fs.renameSync(temp, output)
console.log(`[aed-navi] ${snapshot.count} Okayama AEDs from ${MESHES.length} meshes; version ${version}`)
