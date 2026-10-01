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
console.log('[okayama-landslide] 19,662 candidate point snapshot records passed')
