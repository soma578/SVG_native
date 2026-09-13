#!/usr/bin/env node
// One-time vendoring of the static SVG3 data referenced by the native layers.
// The source checkout is not needed by npm run dev/build after this has run.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = path.resolve(process.argv[2] || path.join(root, '..', 'SVG3-variants', 'svgmap-app-layers-host'))
const copies = [
  ['map/layers/hazard', 'map/layers/hazard'],
  ['map/data/districts/okayama/districts-svg', 'map/data/districts/okayama/districts-svg'],
  ['map/publishers/team-activity-csv', 'map/publishers/team-activity-csv'],
  ['map/publishers/shared/csvQtctPipeline.mjs', 'map/publishers/shared/csvQtctPipeline.mjs'],
  ['map/publishers/shared/zipArchive.mjs', 'map/publishers/shared/zipArchive.mjs'],
  ['map/layers/managed/team-activity-pins', 'map/layers/managed/team-activity-pins'],
  ['map/regions/index.json', 'map/regions/index.json'],
]

for (const [from, to] of copies) {
  const sourcePath = path.join(source, from)
  const destination = path.join(root, to)
  if (!fs.existsSync(sourcePath)) throw new Error(`SVG3 asset is missing: ${sourcePath}`)
  // Publisher assets have local path/runtime adaptations; a repeat import must not erase them.
  if ((from.startsWith('map/publishers/') || from.startsWith('map/layers/managed/')
    || from === 'map/regions/index.json') && fs.existsSync(destination)) {
    console.log(`[svg3-assets] retained local adaptation: ${to}`)
    continue
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  fs.cpSync(sourcePath, destination, { recursive: true, dereference: true, force: true })
  console.log(`[svg3-assets] ${from} -> ${to}`)
}

const indexes = path.join(source, 'frontend/public/data')
for (const region of fs.readdirSync(indexes, { withFileTypes: true })) {
  if (!region.isDirectory()) continue
  const from = path.join(indexes, region.name, 'district-index.json')
  if (!fs.existsSync(from)) continue
  const to = path.join(root, 'map/data/district-indexes', region.name, 'district-index.json')
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.copyFileSync(from, to)
}
console.log('[svg3-assets] district indexes -> map/data/district-indexes/{regionId}/district-index.json')
