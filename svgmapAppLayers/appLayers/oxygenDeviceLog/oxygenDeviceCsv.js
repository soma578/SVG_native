export const OXYGEN_DEVICE_STORAGE_KEY = 'svgmap:oxygen-device-log:csv:v1'

export const OUTPUT_COLUMNS = [
  ['装置ID', 0], ['機種番号', 1], ['装置シリアルNo', 2], ['日時', 8], ['イベント内容', 9],
  ['設定流量(L/min)', 10], ['実流量(L/min)', 11], ['酸素濃度(%)', 12],
  ['内部積算時間(時)', 13], ['外部積算時間(時)', 14], ['装置状態', 15],
  ['RSRP', 16], ['RSRQ', 17], ['緯度', 18], ['経度', 19], ['バッテリー電圧(V)', 40],
  ['切替時間(秒)', 41], ['切替圧力(kPaG)', 42], ['酸素出口圧力(kPaG)', 43],
  ['PSA圧力(kPaG)', 44], ['コンプレッサー回転数(rpm)', 45],
  ['温度(MAINユニット)(℃)', 46], ['温度(超音波センサ)(℃)', 47], ['リモコン接続台数', 48],
  ['ソフトVer', 50], ['通信フォーマット', 51], ['LTEモジュールVer', 55],
  ['IoT基地局キャリア', 58], ['周波数帯', 59],
]

export const parseCsvRows = (text) => {
  const rows = []
  let row = [], cell = '', quoted = false
  const source = String(text || '').replace(/^\uFEFF/, '')
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { cell += '"'; index += 1 }
      else if (char === '"') quoted = false
      else cell += char
    } else if (char === '"') quoted = true
    else if (char === ',') { row.push(cell); cell = '' }
    else if (char === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = '' }
    else cell += char
  }
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row) }
  return rows.filter((columns) => columns.some((value) => String(value).trim()))
}

const csvCell = (value) => {
  const text = String(value ?? '')
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export const serializeOxygenDeviceRecords = (records) => `${[
  OUTPUT_COLUMNS.map(([name]) => name),
  ...records.map((record) => OUTPUT_COLUMNS.map(([name]) => record[name] ?? '')),
].map((row) => row.map(csvCell).join(',')).join('\n')}\n`

export function normalizeOxygenDeviceCsvText(text) {
  const rows = parseCsvRows(text)
  const errors = []
  if (!rows.length) return { records: [], errors: ['CSVが空です'], csvText: '' }
  const headers = rows[0].map((value) => String(value).trim())
  const isRawLog = headers[0] === '製造番号' && headers[18] === '位置情報(緯度)' && headers[19] === '位置情報(経度)'
  const isPublicCsv = OUTPUT_COLUMNS.every(([name]) => headers.includes(name))
  if (!isRawLog && !isPublicCsv) {
    return { records: [], errors: ['対応していないCSVです。元ログまたは公開用CSVを選択してください'], csvText: '' }
  }

  const records = []
  const ids = new Set()
  rows.slice(1).forEach((values, rowIndex) => {
    const line = rowIndex + 2
    const record = Object.fromEntries(OUTPUT_COLUMNS.map(([name, rawIndex]) => {
      const index = isRawLog ? rawIndex : headers.indexOf(name)
      return [name, String(values[index] ?? '').trim()]
    }))
    const lat = Number(record['緯度'])
    const lng = Number(record['経度'])
    if (!record['装置ID']) errors.push(`${line}行目: 装置IDが空です`)
    else if (ids.has(record['装置ID'])) errors.push(`${line}行目: 装置IDが重複しています`)
    else ids.add(record['装置ID'])
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) errors.push(`${line}行目: 緯度が不正です`)
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) errors.push(`${line}行目: 経度が不正です`)
    records.push(record)
  })
  return {
    records: errors.length ? [] : records,
    errors,
    csvText: errors.length ? '' : serializeOxygenDeviceRecords(records),
    sourceKind: isRawLog ? 'raw-log' : 'public-csv',
  }
}

export function normalizeOxygenDeviceCsvBytes(bytes) {
  let text
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    text = new TextDecoder('shift_jis', { fatal: true }).decode(bytes)
  }
  return normalizeOxygenDeviceCsvText(text)
}
