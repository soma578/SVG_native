export const CATALOG_URL = 'https://mosa-github.github.io/data_test_server_page/public-data/catalog.json'

const DATA_ROOT = new URL('./', CATALOG_URL)
const DATASET_NAMES = new Set(['latest', 'locations', 'cameras'])
const SENSOR_TYPES = new Set(['generator', 'water', 'power'])
const STATUS_TYPES = new Set(['normal', 'warning', 'offline', 'error'])
const IMAGE_PATH = /^\/data_test_server_page\/public-data\/images\/[a-f0-9]{32}\.(?:jpg|png)$/

function text(value, maximum = 120) {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : ''
}

function timestamp(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null
}

function timestampMs(value) {
  return value ? Date.parse(value) : 0
}

function status(value) {
  const normalized = text(value, 16).toLowerCase()
  return STATUS_TYPES.has(normalized) ? normalized : 'unknown'
}

export function approvedDatasetUrl(catalog, id) {
  if (!DATASET_NAMES.has(id) || !Array.isArray(catalog?.datasets)) throw new Error('公開データ一覧が不正です')
  const entry = catalog.datasets.find((item) => item?.id === id)
  if (!entry) throw new Error(`${id} が公開データ一覧にありません`)
  const url = new URL(entry.url, CATALOG_URL)
  if (url.href !== new URL(`${id}.json`, DATA_ROOT).href || entry.format !== 'json') {
    throw new Error(`${id} のURLが許可範囲外です`)
  }
  return url.href
}

function approvedImageUrl(raw) {
  if (typeof raw !== 'string') return null
  try {
    const url = new URL(raw)
    return url.origin === DATA_ROOT.origin && !url.username && !url.password
      && !url.search && !url.hash && IMAGE_PATH.test(url.pathname) ? url.href : null
  } catch {
    return null
  }
}

export function normalizePublicData(catalog, latest, locations, cameras) {
  if (!Array.isArray(latest) || latest.length > 10000 || !Array.isArray(locations)
    || locations.length > 2000 || !Array.isArray(cameras) || cameras.length > 2000) {
    throw new Error('公開データの形式または件数が不正です')
  }
  for (const id of DATASET_NAMES) approvedDatasetUrl(catalog, id)

  const facilityMap = new Map()
  for (const row of locations) {
    const id = text(row?.facility_id, 80)
    const lat = row?.latitude
    const lng = row?.longitude
    if (!id || facilityMap.has(id) || typeof lat !== 'number' || !Number.isFinite(lat)
      || lat < -90 || lat > 90 || typeof lng !== 'number' || !Number.isFinite(lng)
      || lng < -180 || lng > 180) continue
    facilityMap.set(id, {
      id, name: text(row.facility_name, 120) || `施設 ${id}`, lat, lng,
      sensors: [], cameras: [], measuredAt: null,
    })
  }

  let skippedRows = 0
  const sensorMap = new Map()
  for (const row of latest) {
    const facilityId = text(row?.facility_id, 80)
    const sensorId = text(row?.sensor_id, 80)
    const type = text(row?.type, 32)
    const facility = facilityMap.get(facilityId)
    if (!facility || !sensorId || !SENSOR_TYPES.has(type)) { skippedRows++; continue }
    const value = row.value
    if (value !== null && (typeof value !== 'number' || !Number.isFinite(value))) { skippedRows++; continue }
    const sensor = {
      id: sensorId, name: text(row.name, 120) || type, type, value,
      unit: text(row.unit, 16), status: status(row.status), measuredAt: timestamp(row.measured_at),
    }
    const key = `${facilityId}\u0000${type}\u0000${sensorId}`
    const previous = sensorMap.get(key)
    if (!previous || timestampMs(sensor.measuredAt) > timestampMs(previous.sensor.measuredAt)) {
      sensorMap.set(key, { facility, sensor })
    }
  }
  for (const { facility, sensor } of sensorMap.values()) facility.sensors.push(sensor)

  for (const row of cameras) {
    const facility = facilityMap.get(text(row?.facility_id, 80))
    const imageUrl = approvedImageUrl(row?.image_url)
    if (!facility || !imageUrl) { skippedRows++; continue }
    facility.cameras.push({
      id: text(row.sensor_id, 80), name: text(row.name, 120) || 'カメラ',
      imageUrl, status: status(row.status), measuredAt: timestamp(row.measured_at),
    })
  }

  const order = { generator: 0, water: 1, power: 2 }
  const facilities = [...facilityMap.values()]
  for (const facility of facilities) {
    facility.sensors.sort((a, b) => order[a.type] - order[b.type] || a.name.localeCompare(b.name, 'ja'))
    facility.cameras.sort((a, b) => a.name.localeCompare(b.name, 'ja'))
    for (const item of [...facility.sensors, ...facility.cameras]) {
      if (item.measuredAt && (!facility.measuredAt || Date.parse(item.measuredAt) > Date.parse(facility.measuredAt))) {
        facility.measuredAt = item.measuredAt
      }
    }
  }
  facilities.sort((a, b) => a.name.localeCompare(b.name, 'ja'))
  return { facilities, generatedAt: timestamp(catalog.generated_at), skippedRows }
}

export function facilityState(facility, now = Date.now()) {
  const readings = [...facility.sensors, ...facility.cameras]
  if (!readings.length || readings.some((item) => {
    const observedAt = item.measuredAt ? Date.parse(item.measuredAt) : NaN
    return !Number.isFinite(observedAt) || now - observedAt > 30 * 60 * 1000 || observedAt - now > 5 * 60 * 1000
  })) {
    return ['unknown', '古い情報・未取得']
  }
  const statuses = readings.map((item) => item.status)
  if (statuses.some((item) => item === 'error' || item === 'offline')) return ['unavailable', '異常・オフライン']
  if (statuses.some((item) => item === 'warning' || item === 'unknown')) return ['partial', '要確認']
  return ['available', '正常']
}
