#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const layerDirectory = path.join(root, 'svgmapAppLayers/appLayers/okayamaLandslideCandidates')
const candidatesPath = path.join(layerDirectory, 'candidates.json')
const outputDirectory = path.join(layerDirectory, 'geometry')
const cachePath = path.join(root, '.okayama-landslide-geometry-cache.ndjson')
const base = 'https://www.gis.pref.okayama.jp/pref-okayama'
const concurrency = Math.max(1, Math.min(16, Number(process.env.OKAYAMA_GIS_CONCURRENCY || 8)))
const candidates = JSON.parse(fs.readFileSync(candidatesPath, 'utf8'))

// 岡山県GISのGetFeature応答はEPSG:4301（旧日本測地系）。同GISが公開する
// GeoAccessJSのtky2jdk()と同じ楕円体・3平行移動量でJGD2000へ変換する。
// JGD2000の経緯度は、この表示精度ではSVGMapのCRS84/WGS84と同等に扱える。
function tokyoDatumToCrs84(lon, lat) {
  const radians = Math.PI / 180
  const sourceA = 6377397.155
  const sourceInverseFlattening = 299.152813
  const sourceFlattening = 1 / sourceInverseFlattening
  const sourceEccentricitySquared = 2 * sourceFlattening - sourceFlattening ** 2
  const latitude = lat * radians, longitude = lon * radians
  const sinLatitude = Math.sin(latitude), cosLatitude = Math.cos(latitude)
  const primeVerticalRadius = sourceA / Math.sqrt(1 - sourceEccentricitySquared * sinLatitude ** 2)
  const sourceX = primeVerticalRadius * cosLatitude * Math.cos(longitude)
  const sourceY = primeVerticalRadius * cosLatitude * Math.sin(longitude)
  const sourceZ = primeVerticalRadius * (1 - sourceEccentricitySquared) * sinLatitude

  const x = sourceX - 146.414
  const y = sourceY + 507.337
  const z = sourceZ + 680.507
  const targetA = 6378137.0
  const targetInverseFlattening = 298.257222101
  const targetFlattening = 1 / targetInverseFlattening
  const targetEccentricitySquared = 2 * targetFlattening - targetFlattening ** 2
  const horizontal = Math.hypot(x, y)
  const radius = Math.hypot(horizontal, z)
  const auxiliary = Math.atan((z / horizontal) *
    (1 - targetFlattening + targetEccentricitySquared * targetA / radius))
  const sinAuxiliaryCubed = Math.sin(auxiliary) ** 3
  const cosAuxiliaryCubed = Math.cos(auxiliary) ** 3
  const targetLatitude = Math.atan((z * (1 - targetFlattening) +
    targetEccentricitySquared * targetA * sinAuxiliaryCubed) /
    ((1 - targetFlattening) * (horizontal - targetEccentricitySquared * targetA * cosAuxiliaryCubed)))
  return [Math.atan2(y, x) / radians, targetLatitude / radians]
}

let cookie = ''
async function officialFetch(pathname, options = {}) {
  const response = await fetch(`${base}${pathname}`, {
    ...options,
    redirect: 'manual',
    headers: { ...(options.headers || {}), ...(cookie ? { Cookie: cookie } : {}) },
  })
  for (const value of response.headers.getSetCookie?.() || []) {
    const pair = value.split(';', 1)[0]
    const name = pair.split('=', 1)[0]
    cookie = [...cookie.split('; ').filter((item) => item && !item.startsWith(`${name}=`)), pair].join('; ')
  }
  return response
}

async function establishSession() {
  let response = await officialFetch('/Agreement?IsPost=False&MapId=5002&RequestPage=%2fpref-okayama%2fPositionSelect%3fmid%3d5002')
  if (!response.ok) throw new Error(`Agreement HTTP ${response.status}`)
  await response.body?.cancel().catch(() => {})
  response = await officialFetch('/Agreement/Agree', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ MapId: '5002' }),
  })
  if (!response.ok) throw new Error(`Agreement confirmation HTTP ${response.status}`)
  await response.body?.cancel().catch(() => {})
}

async function fetchGeometry(record, attempt = 1) {
  try {
    const response = await officialFetch('/Map/GetFeature', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ fid: record.featureId, mid: '5002' }),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) throw new Error(`Unexpected ${contentType || 'response'}`)
    const result = (await response.json())?.JsonResult
    if (result?.fid !== record.featureId || result?.ft !== '5' || !Array.isArray(result.fp) || !result.fp.length) {
      throw new Error('Invalid polygon geometry')
    }
    const rings = result.fp.map((part) => {
      const values = part.split(',').map(Number)
      if (values.length < 6 || values.length % 2 || values.some((value) => !Number.isFinite(value))) {
        throw new Error('Invalid coordinate list')
      }
      return Array.from({ length: values.length / 2 }, (_, index) => [values[index * 2], values[index * 2 + 1]])
    })
    return { id: record.id, featureId: record.featureId, type: record.type, rings }
  } catch (error) {
    if (attempt >= 5) throw new Error(`${record.id}: ${error.message}`)
    await new Promise((resolve) => setTimeout(resolve, attempt * 750))
    if (/Unexpected|HTTP 4|HTTP 5/.test(error.message)) await establishSession()
    return fetchGeometry(record, attempt + 1)
  }
}

function readCache() {
  const result = new Map()
  if (!fs.existsSync(cachePath)) return result
  for (const line of fs.readFileSync(cachePath, 'utf8').split('\n')) {
    if (!line) continue
    const geometry = JSON.parse(line)
    result.set(geometry.id, geometry)
  }
  return result
}

const fixed = (value) => Number(value).toFixed(6)
  .replace(/(\.\d*?)0+$/, '$1')
  .replace(/\.$/, '')
function simplifyRing(ring, tolerance, boxSmallRings = false) {
  if (!tolerance || ring.length <= 4) return ring
  const selected = [ring[0]]
  const squaredTolerance = tolerance * tolerance
  for (let index = 1; index < ring.length - 1; index += 1) {
    const [lastLon, lastLat] = selected.at(-1)
    const [lon, lat] = ring[index]
    if ((lon - lastLon) ** 2 + (lat - lastLat) ** 2 >= squaredTolerance) selected.push(ring[index])
  }
  if (selected.length < 3) {
    if (!boxSmallRings) return ring
    const bounds = geometryBounds([ring])
    if (bounds.west === bounds.east || bounds.south === bounds.north) return ring.slice(0, 3)
    return [[bounds.west, bounds.south], [bounds.east, bounds.south],
      [bounds.east, bounds.north], [bounds.west, bounds.north]]
  }
  return selected
}

function pathData(rings, tolerance, boxSmallRings) {
  return rings.map((original) => simplifyRing(original, tolerance, boxSmallRings).map(([lon, lat], index) =>
    `${index ? 'L' : 'M'}${fixed(lon * 100)},${fixed(-lat * 100)}`).join('') + 'Z').join('')
}

function geometryBounds(rings) {
  let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      west = Math.min(west, lon); east = Math.max(east, lon)
      south = Math.min(south, lat); north = Math.max(north, lat)
    }
  }
  return { west, south, east, north }
}

function writeHitIndex(records, geometries) {
  const hitDirectory = path.join(outputDirectory, 'hit')
  const gridSize = 0.1
  const shards = new Map()
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]
    const geometry = geometries[index]
    const geometryBox = geometryBounds(geometry.rings)
    const key = `${Math.floor(((geometryBox.west + geometryBox.east) / 2) / gridSize)}-${Math.floor(((geometryBox.south + geometryBox.north) / 2) / gridSize)}`
    if (!shards.has(key)) shards.set(key, [])
    const rings = geometry.rings.map((ring) => simplifyRing(ring, 0.00002)
      .map(([lon, lat]) => [Number(fixed(lon)), Number(fixed(lat))]))
    shards.get(key).push({
      id: record.id, type: record.type, siteNumber: record.siteNumber,
      location: record.location, householdClass: record.householdClass,
      bounds: geometryBounds(rings), rings,
    })
  }

  fs.mkdirSync(hitDirectory, { recursive: true })
  const index = []
  for (const [key, features] of [...shards].sort(([a], [b]) => a.localeCompare(b))) {
    const filename = `${key}.json`
    const bounds = features.reduce((result, feature) => ({
      west: Math.min(result.west, feature.bounds.west),
      south: Math.min(result.south, feature.bounds.south),
      east: Math.max(result.east, feature.bounds.east),
      north: Math.max(result.north, feature.bounds.north),
    }), { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity })
    const counts = Object.fromEntries(['急傾斜', '土石流'].map((type) =>
      [type, features.filter((feature) => feature.type === type).length]))
    fs.writeFileSync(path.join(hitDirectory, filename), `${JSON.stringify({ features })}\n`)
    index.push({ url: `./geometry/hit/${filename}`, bounds, counts, count: features.length })
  }
  fs.writeFileSync(path.join(hitDirectory, 'index.json'), `${JSON.stringify({
    schemaVersion: 1, total: records.length, gridSize, shards: index,
  })}\n`)
  return { shards: index.length, total: records.length }
}

function writeSvg(type, geometries, { filename, tolerance, chunkSize, boxSmallRings = false }) {
  const selected = geometries.filter((geometry) => geometry.type === type)
  let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity
  for (const geometry of selected) {
    for (const ring of geometry.rings) {
      for (const [lon, lat] of ring) {
        west = Math.min(west, lon); east = Math.max(east, lon)
        south = Math.min(south, lat); north = Math.max(north, lat)
      }
    }
  }
  const steep = type === '急傾斜'
  const paths = []
  for (let offset = 0; offset < selected.length; offset += chunkSize) {
    paths.push(`<path d="${selected.slice(offset, offset + chunkSize)
      .map((geometry) => pathData(geometry.rings, tolerance, boxSmallRings)).join('')}"/>`)
  }
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fixed(west * 100)} ${fixed(-north * 100)} ${fixed((east - west) * 100)} ${fixed((north - south) * 100)}">
  <globalCoordinateSystem srsName="http://purl.org/crs/84" transform="matrix(100,0,0,-100,0,0)"/>
  <g fill="${steep ? '#c56a32' : '#3b82c4'}" fill-opacity="0.32" fill-rule="nonzero"
     stroke="${steep ? '#993300' : '#005ce6'}" stroke-opacity="0.9" stroke-width="0.006" stroke-linejoin="round">
${paths.join('\n')}
  </g>
</svg>
`
  fs.writeFileSync(path.join(outputDirectory, filename), svg)
  return { type, filename, count: selected.length, bounds: { west, south, east, north }, bytes: Buffer.byteLength(svg) }
}

function writeShardedSvgSet(type, geometries, { name, tolerance, chunkSize, gridSize = 0.1 }) {
  const steep = type === '急傾斜'
  const slug = steep ? 'steep' : 'debris'
  const directory = path.join(outputDirectory, 'shards', name, slug)
  const shards = new Map()
  for (const geometry of geometries.filter((item) => item.type === type)) {
    const bounds = geometryBounds(geometry.rings)
    const x = Math.floor(((bounds.west + bounds.east) / 2) / gridSize)
    const y = Math.floor(((bounds.south + bounds.north) / 2) / gridSize)
    const key = `${x}-${y}`
    if (!shards.has(key)) shards.set(key, [])
    shards.get(key).push({ geometry, bounds })
  }

  fs.mkdirSync(directory, { recursive: true })
  const animations = []
  let totalBytes = 0
  for (const [key, entries] of [...shards].sort(([a], [b]) => a.localeCompare(b))) {
    const bounds = entries.reduce((result, entry) => ({
      west: Math.min(result.west, entry.bounds.west), south: Math.min(result.south, entry.bounds.south),
      east: Math.max(result.east, entry.bounds.east), north: Math.max(result.north, entry.bounds.north),
    }), { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity })
    const paths = []
    for (let offset = 0; offset < entries.length; offset += chunkSize) {
      paths.push(`<path d="${entries.slice(offset, offset + chunkSize)
        .map(({ geometry }) => pathData(geometry.rings, tolerance, false)).join('')}"/>`)
    }
    const content = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fixed(bounds.west * 100)} ${fixed(-bounds.north * 100)} ${fixed((bounds.east - bounds.west) * 100)} ${fixed((bounds.north - bounds.south) * 100)}">
  <globalCoordinateSystem srsName="http://purl.org/crs/84" transform="matrix(100,0,0,-100,0,0)"/>
  <g fill="${steep ? '#c56a32' : '#3b82c4'}" fill-opacity="0.32" fill-rule="nonzero"
     stroke="${steep ? '#993300' : '#005ce6'}" stroke-opacity="0.9" stroke-width="0.006" stroke-linejoin="round">
${paths.join('\n')}
  </g>
</svg>
`
    const filename = `${key}.svg`
    fs.writeFileSync(path.join(directory, filename), content)
    totalBytes += Buffer.byteLength(content)
    animations.push(`  <animation href="./shards/${name}/${slug}/${filename}" xlink:href="./shards/${name}/${slug}/${filename}"
    x="${fixed(bounds.west * 100)}" y="${fixed(-bounds.north * 100)}" width="${fixed((bounds.east - bounds.west) * 100)}" height="${fixed((bounds.north - bounds.south) * 100)}" visibility="visible"/>`)
  }
  const allBounds = geometries.filter((item) => item.type === type).reduce((result, geometry) => {
    const bounds = geometryBounds(geometry.rings)
    return { west: Math.min(result.west, bounds.west), south: Math.min(result.south, bounds.south),
      east: Math.max(result.east, bounds.east), north: Math.max(result.north, bounds.north) }
  }, { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity })
  const wrapper = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
  viewBox="${fixed(allBounds.west * 100)} ${fixed(-allBounds.north * 100)} ${fixed((allBounds.east - allBounds.west) * 100)} ${fixed((allBounds.north - allBounds.south) * 100)}">
  <globalCoordinateSystem srsName="http://purl.org/crs/84" transform="matrix(100,0,0,-100,0,0)"/>
${animations.join('\n')}
</svg>
`
  const wrapperFilename = `${slug}-${name}-shards.svg`
  fs.writeFileSync(path.join(outputDirectory, wrapperFilename), wrapper)
  return { type, name, filename: wrapperFilename, shards: shards.size,
    count: [...shards.values()].reduce((sum, entries) => sum + entries.length, 0),
    bytes: totalBytes + Buffer.byteLength(wrapper), bounds: allBounds }
}

function pointInRing(lon, lat, ring) {
  let inside = false
  for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current, current += 1) {
    const [x1, y1] = ring[current]
    const [x2, y2] = ring[previous]
    if ((y1 > lat) !== (y2 > lat) && lon < (x2 - x1) * (lat - y1) / (y2 - y1) + x1) inside = !inside
  }
  return inside
}

function segmentIntersectsBox([x1, y1], [x2, y2], west, south, east, north) {
  let start = 0, end = 1
  const dx = x2 - x1, dy = y2 - y1
  for (const [p, q] of [[-dx, x1 - west], [dx, east - x1], [-dy, y1 - south], [dy, north - y1]]) {
    if (p === 0 && q < 0) return false
    if (p === 0) continue
    const ratio = q / p
    if (p < 0) start = Math.max(start, ratio)
    else end = Math.min(end, ratio)
    if (start > end) return false
  }
  return true
}

function geometryIntersectsCell(rings, west, south, east, north) {
  const testPoints = [[west, south], [east, south], [east, north], [west, north],
    [(west + east) / 2, (south + north) / 2]]
  for (const ring of rings) {
    if (testPoints.some(([lon, lat]) => pointInRing(lon, lat, ring))) return true
    for (let index = 0; index < ring.length; index += 1) {
      const point = ring[index]
      if (point[0] >= west && point[0] <= east && point[1] >= south && point[1] <= north) return true
      if (segmentIntersectsBox(point, ring[(index + 1) % ring.length], west, south, east, north)) return true
    }
  }
  return false
}

function writeGridSvg(type, geometries, { filename, gridSize }) {
  const selected = geometries.filter((geometry) => geometry.type === type)
  const rows = new Map()
  for (const geometry of selected) {
    const bounds = geometryBounds(geometry.rings)
    const minX = Math.floor(bounds.west / gridSize), maxX = Math.floor(bounds.east / gridSize)
    const minY = Math.floor(bounds.south / gridSize), maxY = Math.floor(bounds.north / gridSize)
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const west = x * gridSize, south = y * gridSize
        if (!geometryIntersectsCell(geometry.rings, west, south, west + gridSize, south + gridSize)) continue
        if (!rows.has(y)) rows.set(y, new Set())
        rows.get(y).add(x)
      }
    }
  }
  const rectangles = []
  for (const [y, values] of rows) {
    const xs = [...values].sort((a, b) => a - b)
    let start = xs[0], end = xs[0]
    for (const x of xs.slice(1)) {
      if (x === end + 1) { end = x; continue }
      rectangles.push({ west: start * gridSize, east: (end + 1) * gridSize,
        south: y * gridSize, north: (y + 1) * gridSize })
      start = x; end = x
    }
    rectangles.push({ west: start * gridSize, east: (end + 1) * gridSize,
      south: y * gridSize, north: (y + 1) * gridSize })
  }
  const bounds = rectangles.reduce((result, rectangle) => ({
    west: Math.min(result.west, rectangle.west), south: Math.min(result.south, rectangle.south),
    east: Math.max(result.east, rectangle.east), north: Math.max(result.north, rectangle.north),
  }), { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity })
  const pathDataString = rectangles.map((rectangle) =>
    `M${fixed(rectangle.west * 100)},${fixed(-rectangle.north * 100)}` +
    `L${fixed(rectangle.east * 100)},${fixed(-rectangle.north * 100)}` +
    `L${fixed(rectangle.east * 100)},${fixed(-rectangle.south * 100)}` +
    `L${fixed(rectangle.west * 100)},${fixed(-rectangle.south * 100)}Z`).join('')
  const steep = type === '急傾斜'
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fixed(bounds.west * 100)} ${fixed(-bounds.north * 100)} ${fixed((bounds.east - bounds.west) * 100)} ${fixed((bounds.north - bounds.south) * 100)}">
  <globalCoordinateSystem srsName="http://purl.org/crs/84" transform="matrix(100,0,0,-100,0,0)"/>
  <path d="${pathDataString}" fill="${steep ? '#c56a32' : '#3b82c4'}" fill-opacity="0.42"
        stroke="${steep ? '#993300' : '#005ce6'}" stroke-opacity="0.72" stroke-width="0.01"/>
</svg>
`
  fs.writeFileSync(path.join(outputDirectory, filename), svg)
  return { type, filename, count: selected.length, cells: [...rows.values()].reduce((sum, row) => sum + row.size, 0),
    rectangles: rectangles.length, gridSize, bounds, bytes: Buffer.byteLength(svg) }
}

const cache = readCache()
const missing = candidates.records.filter((record) => !cache.has(record.id))
console.log(`[okayama-landslide-geometry] cached ${cache.size}; fetching ${missing.length}; concurrency ${concurrency}`)
if (missing.length) await establishSession()
for (let offset = 0; offset < missing.length; offset += concurrency) {
  const batch = await Promise.all(missing.slice(offset, offset + concurrency).map(fetchGeometry))
  fs.appendFileSync(cachePath, `${batch.map((geometry) => JSON.stringify(geometry)).join('\n')}\n`)
  for (const geometry of batch) cache.set(geometry.id, geometry)
  const completed = Math.min(offset + batch.length, missing.length)
  if (completed % 200 < concurrency || completed === missing.length) {
    console.log(`[okayama-landslide-geometry] ${completed}/${missing.length} fetched (${cache.size}/${candidates.records.length} total)`)
  }
}

const sourceGeometries = candidates.records.map((record) => cache.get(record.id))
if (sourceGeometries.some((geometry) => !geometry)) throw new Error('Geometry cache is incomplete')
const geometries = sourceGeometries.map((geometry) => ({
  ...geometry,
  rings: geometry.rings.map((ring) => ring.map(([lon, lat]) => tokyoDatumToCrs84(lon, lat))),
}))
fs.mkdirSync(outputDirectory, { recursive: true })
const layers = [
  writeSvg('急傾斜', geometries, { filename: 'steep.svg', tolerance: 0.00002, chunkSize: 250 }),
  writeSvg('土石流', geometries, { filename: 'debris.svg', tolerance: 0.00002, chunkSize: 250 }),
]
const overviews = [
  writeSvg('急傾斜', geometries, { filename: 'steep-overview.svg', tolerance: 0.0003, chunkSize: 500 }),
  writeSvg('土石流', geometries, { filename: 'debris-overview.svg', tolerance: 0.0003, chunkSize: 500 }),
]
const shardedOverviews = [
  writeShardedSvgSet('急傾斜', geometries, { name: 'overview', tolerance: 0.0006, chunkSize: 250 }),
  writeShardedSvgSet('土石流', geometries, { name: 'overview', tolerance: 0.0006, chunkSize: 250 }),
]
const shardedDetails = [
  writeShardedSvgSet('急傾斜', geometries, { name: 'detail', tolerance: 0.00002, chunkSize: 125 }),
  writeShardedSvgSet('土石流', geometries, { name: 'detail', tolerance: 0.00002, chunkSize: 125 }),
]
const farOverviews = [
  writeGridSvg('急傾斜', geometries, { filename: 'steep-far.svg', gridSize: 0.005 }),
  writeGridSvg('土石流', geometries, { filename: 'debris-far.svg', gridSize: 0.005 }),
]
const veryFarOverviews = [
  writeGridSvg('急傾斜', geometries, { filename: 'steep-very-far.svg', gridSize: 0.01 }),
  writeGridSvg('土石流', geometries, { filename: 'debris-very-far.svg', gridSize: 0.01 }),
]
const hitIndex = writeHitIndex(candidates.records, geometries)
fs.writeFileSync(path.join(outputDirectory, 'manifest.json'), `${JSON.stringify({
  schemaVersion: 2,
  source: 'https://www.gis.pref.okayama.jp/pref-okayama/PositionSelect?mid=5002',
  sourceCrs: 'EPSG:4301',
  outputCrs: 'OGC:CRS84',
  coordinateTransform: 'Okayama GeoAccessJS tky2jdk (Tokyo Datum to JGD2000)',
  sourceUpdatedAt: candidates.sourceUpdatedAt,
  importedAt: new Date().toISOString(),
  total: geometries.length,
  layers,
  overviews,
  shardedOverviews,
  shardedDetails,
  farOverviews,
  veryFarOverviews,
  hitIndex,
}, null, 2)}\n`)
console.log('[okayama-landslide-geometry] wrote', {
  layers, overviews, shardedOverviews, shardedDetails, farOverviews, veryFarOverviews, hitIndex,
})
