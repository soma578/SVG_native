const OUTPUT_COLUMNS = ['id', 'title', 'lat', 'lon', 'imageUrl', 'description']
const REQUIRED_COLUMNS = ['title', 'lat', 'lon']
const DESCRIPTION_LABELS = ['item2', 'item3', 'item4', 'item5']

export function parseColumnMap(raw) {
  let map
  try { map = JSON.parse(raw || '') }
  catch { throw new Error('SVG3_PRIVATE_SHEET_COLUMNS must be JSON') }
  if (!map || typeof map !== 'object' || Array.isArray(map)) {
    throw new Error('SVG3_PRIVATE_SHEET_COLUMNS must be an object')
  }
  for (const name of REQUIRED_COLUMNS) {
    if (!Number.isSafeInteger(map[name]) || map[name] < 0) {
      throw new Error(`Missing or invalid column: ${name}`)
    }
  }
  for (const name of OUTPUT_COLUMNS.filter((name) => !REQUIRED_COLUMNS.includes(name))) {
    if (map[name] != null && (!Number.isSafeInteger(map[name]) || map[name] < 0)) {
      throw new Error(`Invalid column: ${name}`)
    }
  }
  if (map.descriptionColumns != null && (
    !Array.isArray(map.descriptionColumns) || map.descriptionColumns.length !== DESCRIPTION_LABELS.length
    || map.descriptionColumns.some((column) => !Number.isSafeInteger(column) || column < 0)
  )) throw new Error('Invalid descriptionColumns')
  return map
}

export function parseSpreadsheetId(raw) {
  const value = String(raw || '').trim()
  if (/^[A-Za-z0-9_-]+$/.test(value)) return value
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.hostname !== 'docs.google.com') return null
    return url.pathname.match(/^\/spreadsheets\/d\/([A-Za-z0-9_-]+)(?:\/|$)/)?.[1] || null
  } catch { return null }
}

const csvCell = (value) => {
  const text = String(value ?? '')
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function normalizeSheetValues(values, map, options = {}) {
  if (!Array.isArray(values)) throw new Error('Sheet values are not rows')
  const output = [OUTPUT_COLUMNS]
  for (const [index, row] of values.entries()) {
    if (!Array.isArray(row)) throw new Error(`Invalid row ${index + 1}`)
    if (row.every((cell) => String(cell ?? '').trim() === '')) continue
    const value = (name) => map[name] == null ? '' : String(row[map[name]] ?? '').trim()
    const title = value('title')
    const latText = value('lat')
    const lonText = value('lon')
    const lat = Number(latText)
    const lon = Number(lonText)
    if (!title || !latText || !lonText || !Number.isFinite(lat) || !Number.isFinite(lon)
      || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      throw new Error(`Missing title or invalid coordinates at row ${index + 1}`)
    }
    const rawImageUrl = value('imageUrl')
    const imageUrl = options.transformImageUrl ? options.transformImageUrl(rawImageUrl) : rawImageUrl
    const description = map.descriptionColumns
      ? map.descriptionColumns.map((column, itemIndex) => {
        const text = String(row[column] ?? '').trim()
        return text ? `${DESCRIPTION_LABELS[itemIndex]}: ${text}` : ''
      }).filter(Boolean).join('\n')
      : value('description')
    output.push([value('id') || String(index + 1), title, lat, lon, imageUrl || '', description])
  }
  return output.map((row) => row.map(csvCell).join(',')).join('\n') + '\n'
}
