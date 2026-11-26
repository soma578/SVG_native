const typeOrder = { generator: 0, water: 1, power: 2, camera: 3, outage: 4 }
const outageStates = {
  NORMAL: '通電・稼働',
  '0W_ALERT': '0W・機器停止',
  SWITCH_OFF: 'スイッチOFF',
  OFFLINE: '停電・通信途絶の疑い（停電未確定）',
  BLE_WEAK: 'BLE電波弱',
  NODE_WEAK: '中継器電波弱',
  UNKNOWN: '未確認',
}

// A null power reading is expected for an offline outage sensor. Its state is
// still meaningful and must not be mistaken for an empty facility.
export function formatOutageSummary(sensors) {
  return sensors.filter((sensor) => sensor.type === 'outage').map((sensor) => {
    const state = outageStates[sensor.power_state] || '未確認'
    const reading = sensor.value == null ? '電力値なし' : `${sensor.value}${sensor.unit ? ` ${sensor.unit}` : ''}`
    const demo = sensor.is_demo ? '【検証用】' : ''
    return `${sensor.name || sensor.id}: ${demo}${state}、${reading}`
  }).join(' / ') || '-'
}

// The supplier returns one record per sensor. A facility is the map feature;
// its sensor records become choices in the one-pin detail panel.
export function groupByFacility(sensors) {
  if (!Array.isArray(sensors) || sensors.length > 10000) throw new Error('センサ一覧の形式または件数が不正です')
  const groups = new Map()
  for (const sensor of sensors) {
    const id = sensor?.facility?.id
    if (typeof id !== 'string' || !id || typeof sensor.id !== 'string' || !sensor.id
      || !Number.isFinite(sensor.lat) || !Number.isFinite(sensor.lng)
      || Math.abs(sensor.lat) > 90 || Math.abs(sensor.lng) > 180) continue
    let facility = groups.get(id)
    if (!facility) {
      facility = { id, name: sensor.facility.name || `施設 ${id}`, lat: sensor.lat, lng: sensor.lng, sensors: [] }
      groups.set(id, facility)
    }
    const previousIndex = facility.sensors.findIndex((row) => row.id === sensor.id)
    if (previousIndex === -1) facility.sensors.push(sensor)
    else if (Date.parse(sensor.updated_at) > Date.parse(facility.sensors[previousIndex].updated_at)) {
      facility.sensors[previousIndex] = sensor
    }
  }
  const facilities = [...groups.values()]
  for (const facility of facilities) {
    facility.sensors.sort((a, b) => (typeOrder[a.type] ?? 9) - (typeOrder[b.type] ?? 9)
      || String(a.name || a.id).localeCompare(String(b.name || b.id), 'ja'))
  }
  return facilities.sort((a, b) => a.name.localeCompare(b.name, 'ja'))
}
