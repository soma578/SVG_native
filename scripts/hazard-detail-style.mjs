import fs from 'node:fs'
import path from 'node:path'

// Preserve the original polygons. Only reduce the outline that would otherwise
// render about 9–12 screen pixels wide at the detailed zoom threshold.
const STROKE_WIDTHS = new Map([
  ['hazard-flood', '0.012'],
  ['hazard-tsunami-inundation', '0.012'],
  ['hazard-landslide-warning', '0.012'],
  ['hazard-landslide-special', '0.015'],
])

export function styleOkayamaHazardDetail(source) {
  return source.replace(/<g\s+id="(hazard-[^"]+)"[^>]*>/g, (group, id) => {
    const width = STROKE_WIDTHS.get(id)
    return width ? group.replace(/stroke-width="[^"]+"/, `stroke-width="${width}"`) : group
  })
}

export function prepareOkayamaHazardDetailStyle(publicDir) {
  const root = path.join(publicDir, 'map/layers/hazard/33')
  const files = [path.join(root, 'okayama.svg'),
    ...fs.readdirSync(path.join(root, 'districts')).filter((name) => name.endsWith('.svg'))
      .map((name) => path.join(root, 'districts', name))]
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8')
    const styled = styleOkayamaHazardDetail(source)
    if (styled === source) throw new Error(`Could not style Okayama hazard detail: ${file}`)
    fs.writeFileSync(file, styled)
  }
}
