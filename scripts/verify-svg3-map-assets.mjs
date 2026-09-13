import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceHazard = path.join(root, 'svgmapAppLayers/appLayers/svg3-bosai/hazard')
const container = fs.readFileSync(path.join(root, 'svgmapAppLayers/Container.svg'), 'utf8')

function* walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name)
    if (entry.isDirectory()) yield* walk(filename)
    else if (entry.isFile() && entry.name.endsWith('.svg')) yield filename
  }
}

let hazardReferences = 0
for (const filename of walk(sourceHazard)) {
  const svg = fs.readFileSync(filename, 'utf8')
  for (const [, relative] of svg.matchAll(/(?:href|xlink:href)="\/map\/layers\/hazard\/([^"#?]+)"/g)) {
    assert(fs.existsSync(path.join(root, 'map/layers/hazard', relative)), `Missing hazard SVG: ${relative}`)
    hazardReferences++
  }
}
assert(hazardReferences > 1000, 'Hazard source references were not found')

assert(container.includes('teamActivityAreaLayer.svg#data='), 'Team activity area is not in Container.svg')
assert(container.includes('districtSvgUrlTemplate=/map/data/districts/{recordRegionId}/districts-svg/{code}.svg'))

const detail = JSON.parse(fs.readFileSync(path.join(root,
  'svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/data/qtct/teamActivity/detail/0.json'), 'utf8'))
const records = []
const visit = (node) => {
  if (!node) return
  if (Array.isArray(node.records)) records.push(...node.records)
  for (const child of node.children || []) visit(child)
}
visit(detail.tree)
assert(records.length > 0, 'Team activity detail has no records')
for (const record of records) {
  const boundary = path.join(root, 'map/data/districts', String(record.regionId),
    'districts-svg', `${record.municipalityCode}.svg`)
  assert(fs.existsSync(boundary), `Missing team activity boundary: ${boundary}`)
}

console.log(`[svg3-assets] ${hazardReferences} hazard references and ${records.length} team activity records resolved`)
