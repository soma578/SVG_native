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
]

for (const [from, to] of copies) {
  const sourcePath = path.join(source, from)
  const destination = path.join(root, to)
  if (!fs.statSync(sourcePath).isDirectory()) throw new Error(`SVG3 asset directory is missing: ${sourcePath}`)
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  fs.cpSync(sourcePath, destination, { recursive: true, dereference: true, force: true })
  console.log(`[svg3-assets] ${from} -> ${to}`)
}
