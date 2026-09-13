// SVG3 publisher records -> the native SVGMap team-activity layer's live CSV.
// Keep the 10-column source CSV unchanged; this is a derived delivery artifact.
export const RUNTIME_COLUMNS = [
  'id', 'title', 'regionId', 'municipalityCode', 'lat', 'lon',
  'status', 'summary', 'description', 'area', 'operator',
]

const csvCell = (value) => {
  const text = String(value ?? '')
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export const buildRuntimeCsv = (records) => {
  const rows = records.map((record) => [
    record.id, record.title, record.regionId, record.municipalityCode,
    record.lat, record.lon, record.status, record.summary,
    record.description, record.area, record.operator,
  ])
  return [RUNTIME_COLUMNS, ...rows].map((row) => row.map(csvCell).join(',')).join('\n') + '\n'
}
