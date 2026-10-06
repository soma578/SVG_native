export const SHEET_HEADERS = [
  'receivedAt', 'id', 'name', 'lat', 'lng', 'waterLevel',
  'tiltDetected', 'batteryOk', 'lastReceivedAt', 'updatedAt',
]

function timestamp(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?(?:Z|[+-]\d\d:\d\d)$/.test(value)) {
    throw new Error(`${label} must be an ISO 8601 timestamp with a time zone`)
  }
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) throw new Error(`${label} is invalid`)
  return new Date(parsed).toISOString()
}

function stakeOf(value, index) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`stakes[${index}] must be an object`)
  }
  const { id, name, lat, lng, waterLevel, tiltDetected, batteryOk, lastReceivedAt } = value
  if (typeof id !== 'string' || !/^[\p{L}\p{N}_-]{1,64}$/u.test(id)) throw new Error(`stakes[${index}].id is invalid`)
  if (typeof name !== 'string' || !name.trim() || name.length > 100) throw new Error(`stakes[${index}].name is invalid`)
  if (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90) throw new Error(`stakes[${index}].lat is invalid`)
  if (typeof lng !== 'number' || !Number.isFinite(lng) || lng < -180 || lng > 180) throw new Error(`stakes[${index}].lng is invalid`)
  if (waterLevel !== null && ![0, 1, 2].includes(waterLevel)) throw new Error(`stakes[${index}].waterLevel is invalid`)
  if (tiltDetected !== null && typeof tiltDetected !== 'boolean') throw new Error(`stakes[${index}].tiltDetected is invalid`)
  if (typeof batteryOk !== 'boolean') throw new Error(`stakes[${index}].batteryOk is invalid`)
  return { id, name: name.trim(), lat, lng, waterLevel, tiltDetected, batteryOk, lastReceivedAt: timestamp(lastReceivedAt, `stakes[${index}].lastReceivedAt`) }
}

export function normalizePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('JSON object required')
  const isBatch = Object.hasOwn(payload, 'stakes')
  const source = isBatch ? payload.stakes : [payload]
  if (!Array.isArray(source) || source.length < 1 || source.length > 100) throw new Error('stakes must contain 1–100 records')
  const updatedAt = payload.updatedAt === undefined ? '' : timestamp(payload.updatedAt, 'updatedAt')
  const seen = new Set()
  const stakes = source.map(stakeOf).filter((stake) => {
    const key = `${stake.id}\0${stake.lastReceivedAt}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return { stakes, updatedAt }
}

export function eventKey(stake) {
  return `${stake.id}\0${stake.lastReceivedAt}`
}

export function sheetRow(stake, updatedAt, receivedAt) {
  return [
    receivedAt, stake.id, stake.name, stake.lat, stake.lng,
    stake.waterLevel === null ? '' : stake.waterLevel,
    stake.tiltDetected === null ? '' : stake.tiltDetected,
    stake.batteryOk, stake.lastReceivedAt, updatedAt,
  ]
}
