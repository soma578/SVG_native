import assert from 'node:assert/strict'
import { groupByFacility } from './view-model.js'

const base = { lat: 34.6507388, lng: 133.9158887, facility: { id: '1', name: '岡山大学病院' } }
const rows = [
  { ...base, id: '3', name: '燃料残量', type: 'generator', updated_at: '2026-10-14T16:12:22+09:00' },
  { ...base, id: '4', name: '水位残量', type: 'water' },
  { ...base, id: '5', name: '電力', type: 'power' },
  { ...base, id: '1', name: 'カメラ１', type: 'camera' },
]
const facilities = groupByFacility(rows)
assert.equal(facilities.length, 1)
assert.equal(facilities[0].name, '岡山大学病院')
assert.deepEqual(facilities[0].sensors.map((sensor) => sensor.id), ['3', '4', '5', '1'])
assert.equal(groupByFacility([...rows, { ...base, id: '3', updated_at: '2026-10-14T16:00:00+09:00' }])[0].sensors.length, 4)
assert.equal(groupByFacility([{ ...base, id: '6', lat: NaN }]).length, 0)
assert.throws(() => groupByFacility({}))
console.log('MOSAdemy one-pin facility grouping passed')
