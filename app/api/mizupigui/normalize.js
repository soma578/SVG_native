export const HISTORY_HEADERS = [
  'receivedAt', 'retryCount', 'logId', 'id', 'name', 'lat', 'lng',
  'waterLevel', 'tiltDetected', 'batteryOk', 'lastReceivedAt', 'floodedAt',
]

export const LATEST_HEADERS = [
  'id', 'name', 'lat', 'lng', 'waterLevel', 'tiltDetected', 'batteryOk',
  'lastReceivedAt', 'floodedAt', 'logId', 'receivedAt', 'retryCount',
]

const LOGPOT_TIMESTAMP = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\+09:00$/

function timestamp(value, label, nullable = false) {
  if (nullable && value === null) return null
  if (typeof value !== 'string' || !LOGPOT_TIMESTAMP.test(value)) {
    throw new Error(label + ' must be an ISO 8601 timestamp with seconds and +09:00')
  }
  if (!Number.isFinite(Date.parse(value))) throw new Error(label + ' is invalid')
  return value
}

function nullableCoordinate(value, minimum, maximum, label) {
  if (value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(label + ' is invalid')
  }
  return value
}

export function normalizePayload(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('JSON object required')
  }

  const {
    logId, id, name, lat, lng, waterLevel,
    tiltDetected, batteryOk, lastReceivedAt, floodedAt,
  } = value

  if (typeof logId !== 'string' || !logId || logId.length > 256 || /[\r\n]/.test(logId)) {
    throw new Error('logId is invalid')
  }
  if (typeof id !== 'string' || !/^[\p{L}\p{N}_-]{1,64}$/u.test(id)) {
    throw new Error('id is invalid')
  }
  if (typeof name !== 'string' || !name.trim() || name.length > 100) {
    throw new Error('name is invalid')
  }

  const normalizedLat = nullableCoordinate(lat, -90, 90, 'lat')
  const normalizedLng = nullableCoordinate(lng, -180, 180, 'lng')

  if (waterLevel !== null && ![0, 1, 2].includes(waterLevel)) {
    throw new Error('waterLevel is invalid')
  }
  if (typeof tiltDetected !== 'boolean') throw new Error('tiltDetected is invalid')
  if (typeof batteryOk !== 'boolean') throw new Error('batteryOk is invalid')

  return {
    logId,
    id,
    name: name.trim(),
    lat: normalizedLat,
    lng: normalizedLng,
    waterLevel,
    tiltDetected,
    batteryOk,
    lastReceivedAt: timestamp(lastReceivedAt, 'lastReceivedAt'),
    floodedAt: timestamp(floodedAt, 'floodedAt', true),
  }
}

function cell(value) {
  return value === null ? '' : value
}

export function historyRow(stake, retryCount, receivedAt) {
  return [
    receivedAt,
    retryCount,
    stake.logId,
    stake.id,
    stake.name,
    cell(stake.lat),
    cell(stake.lng),
    cell(stake.waterLevel),
    stake.tiltDetected,
    stake.batteryOk,
    stake.lastReceivedAt,
    cell(stake.floodedAt),
  ]
}

export function latestRow(stake, retryCount, receivedAt) {
  return [
    stake.id,
    stake.name,
    cell(stake.lat),
    cell(stake.lng),
    cell(stake.waterLevel),
    stake.tiltDetected,
    stake.batteryOk,
    stake.lastReceivedAt,
    cell(stake.floodedAt),
    stake.logId,
    receivedAt,
    retryCount,
  ]
}
