#!/usr/bin/env node
// Copy the working SVGMap CSV/photo layer into a symlink-free sharing folder.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const share = path.join(root, 'share', 'external-csv-photo-layer')
const copies = [
  [
    'svgmapAppLayers/authoringLayers/local/csvLayer',
    'svgmapAppLayers/authoringLayers/local/csvLayer',
  ],
  ['app/api/drive-image/route.js', 'nextjs/app/api/drive-image/route.js'],
  ['svgmapAppLayers/LICENSE', 'svgmapAppLayers/LICENSE'],
]

for (const [source, destination] of copies) {
  const sourcePath = path.join(root, source)
  const destinationPath = path.join(share, destination)
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true })
  fs.cpSync(sourcePath, destinationPath, {
    recursive: true,
    dereference: true,
    force: true,
    filter: (name) => !name.endsWith('.test.mjs'),
  })
}

console.log(`[csv-photo-share] copied working files to ${share}`)
