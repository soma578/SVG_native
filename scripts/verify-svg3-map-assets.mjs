import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseTeamActivityCsv } from '../svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/layers/portable/team-activity/teamActivityCsv.js'

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

const teamLayerController = fs.readFileSync(path.join(root,
  'svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/layers/portable/team-activity/teamActivityLayer.html'), 'utf8')
const areaCore = fs.readFileSync(path.join(root,
  'svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/layers/portable/team-activity/teamActivityAreaCore.js'), 'utf8')
assert(container.includes('title="L3 チーム活動"'), 'Unified team activity is not in Container.svg')
assert(!container.includes('teamActivityAreaLayer.svg'), 'Team activity area should not be a separate root layer')
assert(container.includes('districtSvgUrlTemplate=/map/data/districts/{recordRegionId}/districts-svg/{code}.svg'))
assert(container.includes('sourceCsv=./current.csv'), 'Team activity live CSV is not configured')
assert(teamLayerController.includes('initTeamActivityAreaLayer()'), 'Pin controller does not initialize team activity area')
assert(teamLayerController.includes('runtime.setSourceDocuments(buildTeamActivityCsvDocuments(parsed.records))'), 'Team activity CSV does not replace pin source')
assert(teamLayerController.includes('setTeamActivitySourceRecords(parsed.records)'), 'Team activity CSV does not replace area source')
assert(areaCore.includes("const DRAW_GROUP_ID = 'team-activity-area-draw'"), 'Team activity area renderer is unavailable')

const liveCsv = fs.readFileSync(path.join(root,
  'svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/layers/portable/team-activity/current.csv'), 'utf8')
const parsedLiveCsv = parseTeamActivityCsv(liveCsv)
assert.deepEqual(parsedLiveCsv.errors, [], 'Team activity live CSV is invalid')
assert.equal(parsedLiveCsv.records.length, 3, 'Team activity live CSV initial records are missing')

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
