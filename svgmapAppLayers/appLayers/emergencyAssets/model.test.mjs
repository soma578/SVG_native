import assert from 'node:assert/strict'
import fs from 'node:fs'
import { displayState, parseAssets } from './model.js'

for (const kind of ['battery', 'movingHouse']) {
  const file = kind === 'battery' ? 'battery.json' : 'movingHouse.json'
  const parsed = parseAssets(JSON.parse(fs.readFileSync(new URL(file, import.meta.url), 'utf8')), kind)
  assert.equal(parsed.demo, true)
  assert.equal(parsed.assets.length, 8)
  assert(parsed.assets.every((item) => item.id.startsWith('DEMO-') && item.name.includes('架空')))
  assert.deepEqual(new Set(parsed.assets.map((item) => displayState(item, kind)[0])),
    new Set(['available', 'partial', 'unavailable', 'unknown']))
}

const base = { id: 'X-1', name: '設備', address: null, lat: 34.5, lng: 133.6,
  updatedAt: '2026-10-14T10:30:00+09:00' }
const battery = { ...base, status: 'available', chargePercent: 75, capacityKWh: 10 }
assert.deepEqual(displayState(battery, 'battery'), ['available', '使用可能'])
assert.equal(parseAssets({ updatedAt: base.updatedAt, assets: [battery] }, 'battery').assets.length, 1)
assert.throws(() => parseAssets({ updatedAt: base.updatedAt, assets: [battery, battery] }, 'battery'), /重複/)
assert.throws(() => parseAssets({ updatedAt: base.updatedAt, assets: [{ ...battery, lat: 999 }] }, 'battery'), /緯度/)
assert.throws(() => parseAssets({ updatedAt: base.updatedAt, assets: [{ ...battery, chargePercent: 120 }] }, 'battery'), /残量/)

const house = { ...base, placement: 'installed', accepting: true, capacity: 4, occupied: 2 }
assert.deepEqual(displayState(house, 'movingHouse'), ['available', '入居可能'])
assert.deepEqual(displayState({ ...house, occupied: 4 }, 'movingHouse'), ['partial', '空きなし'])
assert.deepEqual(displayState({ ...house, accepting: false }, 'movingHouse'), ['unavailable', '受付停止'])
assert.deepEqual(displayState({ ...house, accepting: null }, 'movingHouse'), ['unknown', '状況不明'])
assert.deepEqual(displayState({ ...house, placement: 'inTransit', accepting: null }, 'movingHouse'),
  ['unavailable', '未設置・利用不可'])
assert.throws(() => parseAssets({ updatedAt: base.updatedAt, assets: [{ ...house, occupied: 5 }] }, 'movingHouse'), /人数/)
console.log('[emergency-assets] data validation and status mapping passed')
