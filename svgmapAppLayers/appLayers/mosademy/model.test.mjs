import assert from 'node:assert/strict'
import { CATALOG_URL, approvedDatasetUrl, normalizePublicData, facilityState } from './model.js'

const root = 'https://mosa-github.github.io/data_test_server_page/public-data/'
const catalog = {
  generated_at: '2026-10-14T16:15:08+09:00',
  datasets: ['latest', 'locations', 'cameras'].map((id) => ({ id, format: 'json', url: `${root}${id}.json` })),
}
assert.equal(CATALOG_URL, `${root}catalog.json`)
for (const id of ['latest', 'locations', 'cameras']) assert.equal(approvedDatasetUrl(catalog, id), `${root}${id}.json`)
assert.throws(() => approvedDatasetUrl(catalog, 'history'))
assert.throws(() => approvedDatasetUrl({ datasets: [{ id: 'latest', format: 'json', url: 'https://evil.example/latest.json' }] }, 'latest'))

const measured = '2026-10-14T16:12:22+09:00'
const locations = [{ facility_id: '1', facility_name: '岡山大学病院', latitude: 34.6507388, longitude: 133.9158887 }]
const latest = [
  { sensor_id: '3', facility_id: '1', name: '燃料残量', type: 'generator', value: 3232.9, unit: 'L', measured_at: measured, status: 'normal' },
  { sensor_id: '4', facility_id: '1', name: '水位残量', type: 'water', value: 45.5, unit: '%', measured_at: measured, status: 'normal' },
  { sensor_id: '5', facility_id: '1', name: '電力', type: 'power', value: 7031.8, unit: 'W', measured_at: measured, status: 'normal' },
]
const cameras = [
  { sensor_id: '1', facility_id: '1', name: 'カメラ１', image_url: `${root}images/6b86b273ff34fce19d6b804eff5a3f57.jpg`, measured_at: measured, status: 'normal' },
  { sensor_id: '2', facility_id: '1', name: '不正な画像', image_url: 'https://example.com/image.jpg', measured_at: measured, status: 'normal' },
]
const result = normalizePublicData(catalog, latest, locations, cameras)
assert.equal(result.facilities.length, 1)
assert.equal(result.facilities[0].name, '岡山大学病院')
assert.deepEqual(result.facilities[0].sensors.map((item) => item.type), ['generator', 'water', 'power'])
assert.equal(result.facilities[0].cameras.length, 1)
assert.equal(result.skippedRows, 1)
assert.equal(facilityState(result.facilities[0], Date.parse(measured) + 5 * 60_000)[0], 'available')
assert.equal(facilityState(result.facilities[0], Date.parse(measured) + 31 * 60_000)[0], 'unknown')
assert.equal(facilityState(result.facilities[0], Date.parse(measured) - 6 * 60_000)[0], 'unknown')
assert.equal(facilityState({ ...result.facilities[0], sensors: [{ status: 'offline', measuredAt: measured }] }, Date.parse(measured))[0], 'unavailable')
assert.equal(facilityState({ ...result.facilities[0], sensors: [{ status: 'warning', measuredAt: measured }] }, Date.parse(measured))[0], 'partial')
assert.equal(facilityState({ ...result.facilities[0], sensors: [{ status: 'normal', measuredAt: null }] }, Date.parse(measured))[0], 'unknown')
assert.throws(() => normalizePublicData(catalog, {}, locations, cameras))
console.log('MOSAdemy public-data model checks passed')
