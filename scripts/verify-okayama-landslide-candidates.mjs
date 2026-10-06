import assert from 'node:assert/strict'
import fs from 'node:fs'

const data = JSON.parse(fs.readFileSync('svgmapAppLayers/appLayers/okayamaLandslideCandidates/candidates.json', 'utf8'))
assert.equal(data.schemaVersion, 1)
assert.deepEqual(data.counts, { steepSlope: 16794, debrisFlow: 2868, total: 19662 })
assert.equal(data.records.length, 19662)
assert.equal(new Set(data.records.map((record) => record.id)).size, 19662)
assert(data.records.every((record) => ['急傾斜', '土石流'].includes(record.type)
  && Number.isFinite(record.lat) && Number.isFinite(record.lon)
  && record.lat >= 34 && record.lat <= 36 && record.lon >= 133 && record.lon <= 135))
assert(data.records.every((record) => record.siteNumber && record.location && record.householdClass))
const manifest = JSON.parse(fs.readFileSync('svgmapAppLayers/appLayers/okayamaLandslideCandidates/geometry/manifest.json', 'utf8'))
assert.equal(manifest.schemaVersion, 2)
assert.equal(manifest.sourceCrs, 'EPSG:4301')
assert.equal(manifest.outputCrs, 'OGC:CRS84')
assert.equal(manifest.total, 19662)
assert.deepEqual(manifest.layers.map(({ type, count }) => ({ type, count })), [
  { type: '急傾斜', count: 16794 }, { type: '土石流', count: 2868 },
])
assert.deepEqual(manifest.overviews.map(({ type, count }) => ({ type, count })), [
  { type: '急傾斜', count: 16794 }, { type: '土石流', count: 2868 },
])
assert.deepEqual(manifest.farOverviews.map(({ type, count }) => ({ type, count })), [
  { type: '急傾斜', count: 16794 }, { type: '土石流', count: 2868 },
])
assert.deepEqual(manifest.veryFarOverviews.map(({ type, count }) => ({ type, count })), [
  { type: '急傾斜', count: 16794 }, { type: '土石流', count: 2868 },
])
for (const collection of [manifest.shardedOverviews, manifest.shardedDetails]) {
  assert.deepEqual(collection.map(({ type, count }) => ({ type, count })), [
    { type: '急傾斜', count: 16794 }, { type: '土石流', count: 2868 },
  ])
  assert(collection.every(({ shards }) => shards > 80), 'Polygon LODs must use fine spatial shards')
}
for (const name of ['steep.svg', 'debris.svg']) {
  const geometry = fs.readFileSync(`svgmapAppLayers/appLayers/okayamaLandslideCandidates/geometry/${name}`, 'utf8')
  assert(geometry.includes('fill-opacity="0.32"') && geometry.includes('<path d="M'), `${name} must contain filled polygons`)
  assert((geometry.match(/<path /g) || []).length < 100, `${name} must use compound paths instead of one DOM node per feature`)
}
for (const name of ['steep-far.svg', 'debris-far.svg', 'steep-very-far.svg', 'debris-very-far.svg']) {
  const geometry = fs.readFileSync(`svgmapAppLayers/appLayers/okayamaLandslideCandidates/geometry/${name}`, 'utf8')
  assert(geometry.includes('<path d="M'), `${name} must contain coarse filled polygons`)
}
for (const name of ['steep-overview-shards.svg', 'debris-overview-shards.svg',
  'steep-detail-shards.svg', 'debris-detail-shards.svg']) {
  const wrapper = fs.readFileSync(`svgmapAppLayers/appLayers/okayamaLandslideCandidates/geometry/${name}`, 'utf8')
  assert((wrapper.match(/<animation /g) || []).length > 80, `${name} must spatially load fine polygon shards`)
}
const hitIndex = JSON.parse(fs.readFileSync('svgmapAppLayers/appLayers/okayamaLandslideCandidates/geometry/hit/index.json', 'utf8'))
assert.equal(hitIndex.total, 19662)
assert.equal(hitIndex.shards.reduce((sum, shard) => sum + shard.count, 0), 19662)
assert.equal(hitIndex.shards.reduce((sum, shard) => sum + shard.counts['急傾斜'], 0), 16794)
assert.equal(hitIndex.shards.reduce((sum, shard) => sum + shard.counts['土石流'], 0), 2868)
assert(hitIndex.shards.length > 1, 'Polygon hit data must be geographically sharded')
for (const shard of hitIndex.shards) {
  assert(fs.existsSync(`svgmapAppLayers/appLayers/okayamaLandslideCandidates/${shard.url.replace('./', '')}`))
}
let controlFeature
for (const shard of hitIndex.shards) {
  const payload = JSON.parse(fs.readFileSync(
    `svgmapAppLayers/appLayers/okayamaLandslideCandidates/${shard.url.replace('./', '')}`, 'utf8'))
  controlFeature = payload.features.find((feature) => feature.id === '急傾斜-12010001')
  if (controlFeature) break
}
assert(controlFeature, 'Datum conversion control feature must exist')
assert(controlFeature.bounds.west > 133.970 && controlFeature.bounds.east < 133.972
  && controlFeature.bounds.south > 34.655 && controlFeature.bounds.north < 34.657,
'Tokyo Datum control feature must be converted to CRS84 near Okayama-shi Maruyama')
const layerScript = fs.readFileSync('svgmapAppLayers/appLayers/okayamaLandslideCandidates/okayamaLandslideCandidates.js', 'utf8')
assert(!layerScript.includes('/api/okayama-landslide-map')
  && layerScript.includes("svgImage.getElementById('steepPolygons')")
  && layerScript.includes('window.customHitTester = customHitTester')
  && layerScript.includes('pointInRing')
  && layerScript.includes('POLYGON_DETAIL_VIEW_WIDTH')
  && layerScript.includes('POLYGON_VERY_FAR_VIEW_WIDTH')
  && !layerScript.includes('candidates.json')
  && !layerScript.includes('candidatePoint')
  && !layerScript.includes('aggregate('), 'The layer must render official GIS outlines instead of aggregate rectangles')
console.log('[okayama-landslide] 19,662 static filled official GIS polygons and sharded polygon hit data passed')
