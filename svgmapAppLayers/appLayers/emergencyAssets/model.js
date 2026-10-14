const BATTERY_STATES = new Set(['available', 'inUse', 'fault', 'unknown'])
const PLACEMENT_STATES = new Set(['inTransit', 'installing', 'installed', 'unknown'])

function requiredText(value, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > 120) throw new Error(`${label} が不正です`)
  return value.trim()
}

function optionalText(value, label) {
  if (value == null || value === '') return null
  return requiredText(value, label)
}

function numberInRange(value, min, max, label, nullable = false) {
  if (nullable && value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${label} が不正です`)
  }
  return value
}

function timestamp(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(value)
    || !Number.isFinite(Date.parse(value))) throw new Error(`${label} が不正です`)
  return value
}

export function parseAssets(data, kind) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.assets) || data.assets.length > 2000) {
    throw new Error('データ形式または件数が不正です')
  }
  if (data.demo !== undefined && typeof data.demo !== 'boolean') throw new Error('デモ指定が不正です')
  if (data.updatedAt !== null) timestamp(data.updatedAt, 'データ更新日時')
  const ids = new Set()
  const assets = data.assets.map((item) => {
    if (!item || typeof item !== 'object') throw new Error('設備データが不正です')
    const base = {
      id: requiredText(item.id, '設備ID'),
      name: requiredText(item.name, '名称'),
      address: optionalText(item.address, '住所'),
      lat: numberInRange(item.lat, -90, 90, '緯度'),
      lng: numberInRange(item.lng, -180, 180, '経度'),
      updatedAt: timestamp(item.updatedAt, '最終確認日時'),
    }
    if (ids.has(base.id)) throw new Error(`設備IDが重複しています: ${base.id}`)
    ids.add(base.id)
    if (kind === 'battery') {
      if (!BATTERY_STATES.has(item.status)) throw new Error(`${base.id}: 稼働状態が不正です`)
      return {
        ...base, status: item.status,
        chargePercent: numberInRange(item.chargePercent, 0, 100, '残量', true),
        capacityKWh: numberInRange(item.capacityKWh, 0, 100000, '定格容量', true),
      }
    }
    if (kind === 'movingHouse') {
      if (!PLACEMENT_STATES.has(item.placement)) throw new Error(`${base.id}: 設置状況が不正です`)
      if (![true, false, null].includes(item.accepting)) throw new Error(`${base.id}: 入居受付が不正です`)
      const capacity = numberInRange(item.capacity, 0, 10000, '定員', true)
      const occupied = numberInRange(item.occupied, 0, 10000, '入居人数', true)
      if ((capacity !== null && !Number.isInteger(capacity)) || (occupied !== null && !Number.isInteger(occupied))
        || (capacity !== null && occupied !== null && occupied > capacity)) {
        throw new Error(`${base.id}: 人数が不正です`)
      }
      return { ...base, placement: item.placement, accepting: item.accepting, capacity, occupied }
    }
    throw new Error('未対応の設備種別です')
  })
  return { updatedAt: data.updatedAt, demo: data.demo === true, assets }
}

export function displayState(item, kind) {
  if (kind === 'battery') {
    return {
      available: ['available', '使用可能'],
      inUse: ['partial', '使用中'],
      fault: ['unavailable', '故障・利用不可'],
      unknown: ['unknown', '状況不明'],
    }[item.status]
  }
  if (item.placement === 'unknown') return ['unknown', '状況不明']
  if (item.placement !== 'installed') return ['unavailable', '未設置・利用不可']
  if (item.accepting === null || item.capacity === null || item.occupied === null) return ['unknown', '状況不明']
  if (!item.accepting) return ['unavailable', '受付停止']
  return item.occupied < item.capacity ? ['available', '入居可能'] : ['partial', '空きなし']
}
