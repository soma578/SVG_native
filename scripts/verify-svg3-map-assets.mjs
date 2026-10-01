import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseTeamActivityCsv } from '../svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/layers/portable/team-activity/teamActivityCsv.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceHazard = path.join(root, 'svgmapAppLayers/appLayers/svg3-bosai/hazard')
const hazardVectorOverview = path.join(root, 'svgmapAppLayers/appLayers/svg3-bosai/hazard-vector-overview')
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
assert(fs.existsSync(path.join(hazardVectorOverview, 'national.svg')), 'Missing national vector hazard overview')
assert.equal(
  fs.readdirSync(path.join(hazardVectorOverview, 'pref')).filter((name) => /^\d{2}\.svg$/.test(name)).length,
  47,
  'Expected vector hazard overviews for all prefectures',
)

const teamLayerController = fs.readFileSync(path.join(root,
  'svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/layers/portable/team-activity/teamActivityLayer.html'), 'utf8')
const areaCore = fs.readFileSync(path.join(root,
  'svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/layers/portable/team-activity/teamActivityAreaCore.js'), 'utf8')
assert(container.includes('title="L3 チーム活動"'), 'Unified team activity is not in Container.svg')
assert(!container.includes('teamActivityAreaLayer.svg'), 'Team activity area should not be a separate root layer')
assert(container.includes('districtSvgUrlTemplate=/map/data/districts/{recordRegionId}/districts-svg/{code}.svg'))
assert(container.includes('sourceCsv=./current.csv'), 'Team activity live CSV is not configured')
assert(teamLayerController.includes('initTeamActivityAreaLayer()'), 'Pin controller does not initialize team activity area')
assert(teamLayerController.includes('runtime.setSourceDocuments(buildTeamActivityCsvDocuments(visibleRecords))'), 'Team activity CSV does not replace pin source')
assert(teamLayerController.includes('setTeamActivitySourceRecords(visibleRecords)'), 'Team activity CSV does not replace area source')
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

const portableRoot = path.join(root, 'svgmapAppLayers/appLayers/svg3-bosai')
const evacuationPortable = path.join(portableRoot, 'evacuation/map/layers/portable')
const webcamPortable = path.join(portableRoot, 'japan-river-webcams/map/layers/portable')
for (const relative of [
  'representative-pins/densityPointFormat.js',
  'representative-pins/qtctFeatureEngine.js',
  'representative-pins/representativePinsCore.js',
  'representative-pins/runtimeCache.js',
]) {
  assert.equal(
    fs.readFileSync(path.join(webcamPortable, relative), 'utf8'),
    fs.readFileSync(path.join(evacuationPortable, relative), 'utf8'),
    `Webcam runtime differs from evacuation: ${relative}`,
  )
}
const evacuationPackage = JSON.parse(fs.readFileSync(path.join(evacuationPortable, 'evacuation/layer.package.json'), 'utf8'))
const webcamPackage = JSON.parse(fs.readFileSync(path.join(webcamPortable, 'japan-river-webcams/layer.package.json'), 'utf8'))
assert.deepEqual(evacuationPackage.data, webcamPackage.data, 'Evacuation QTCT injection contract differs from webcam')
assert.deepEqual(evacuationPackage.runtimeDependencies, webcamPackage.runtimeDependencies,
  'Evacuation runtime dependencies differ from webcam')
const evacuationController = fs.readFileSync(path.join(evacuationPortable, 'evacuation/evacuationLayer.html'), 'utf8')
const webcamController = fs.readFileSync(path.join(webcamPortable, 'japan-river-webcams/webcamLayer.html'), 'utf8')
assert(/initRepresentativePinsLayer\(\{\s*mode: 'portable'/.test(evacuationController)
  && !evacuationController.includes('createPortableNetworkClient'),
  'Evacuation startup must follow the webcam representative-pins path')
assert(/initRepresentativePinsLayer\(\{\s*mode: 'portable'/.test(webcamController),
  'Webcam representative-pins baseline is unavailable')

const qtctContract = (relative) => {
  const directory = path.join(portableRoot, relative)
  const summary = JSON.parse(fs.readFileSync(path.join(directory, 'summary.json'), 'utf8'))
  const detailIndex = JSON.parse(fs.readFileSync(path.join(directory, 'detail-index.json'), 'utf8'))
  const density = JSON.parse(fs.readFileSync(path.join(directory, 'density-points.json'), 'utf8'))
  return {
    summaryKeys: Object.keys(summary).sort(),
    detailKeys: Object.keys(detailIndex).sort(),
    densityKeys: Object.keys(density).sort(),
    schemaVersion: summary.schemaVersion,
    detailSchemaVersion: detailIndex.schemaVersion,
    densitySchemaVersion: density.schemaVersion,
    densityEncoding: density.encoding,
  }
}
assert.deepEqual(
  qtctContract('japan-river-webcams/map/data/qtct/japanRiverWebcam'),
  qtctContract('evacuation/map/data/qtct/evacuation'),
  'Webcam QTCT artifact contract differs from evacuation',
)

console.log(`[svg3-assets] ${hazardReferences} hazard references, ${records.length} team activity records, and evacuation-to-webcam QTCT parity resolved`)
