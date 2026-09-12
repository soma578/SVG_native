import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = path.join(root, 'public')
const markerPath = path.join(publicDir, '.svgmap-generated-assets.json')
const markerName = 'scripts/prepare-public-assets.mjs'
const assets = [
  ['svgmap.html', 'index.html'],
  ['svgmapjs', 'svgmapjs'],
  ['svgmapAppLayers', 'svgmapAppLayers'],
  ['sw.js', 'sw.js'],
]

fs.mkdirSync(publicDir, { recursive: true })

let managed = false
if (fs.existsSync(markerPath)) {
  const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'))
  if (marker.managedBy !== markerName) {
    throw new Error(`Refusing to replace assets with an unknown marker: ${markerPath}`)
  }
  managed = true
}

// Validate every target before touching any of the four asset locations.
for (const [destName, sourceName] of assets) {
  const source = path.join(root, sourceName)
  const destination = path.join(publicDir, destName)
  if (!fs.existsSync(source)) throw new Error(`SVGMap asset is missing: ${source}`)
  let current
  try {
    current = fs.lstatSync(destination)
  } catch (error) {
    if (error.code === 'ENOENT') continue
    throw error
  }
  if (managed) continue
  if (!current.isSymbolicLink() || fs.realpathSync(destination) !== fs.realpathSync(source)) {
    throw new Error(`Refusing to replace non-generated public asset: ${destination}`)
  }
}

// The marker also makes a partially completed copy safe to retry.
fs.writeFileSync(markerPath, `${JSON.stringify({ managedBy: markerName })}\n`)

for (const [destName, sourceName] of assets) {
  const source = path.join(root, sourceName)
  const destination = path.join(publicDir, destName)
  try {
    const current = fs.lstatSync(destination)
    if (current.isDirectory()) fs.rmSync(destination, { recursive: true })
    else fs.unlinkSync(destination)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }

  if (fs.statSync(source).isDirectory()) {
    fs.cpSync(source, destination, {
      recursive: true,
      dereference: true,
      force: true,
      filter: (entry) => !['.git', '.next', 'node_modules'].includes(path.basename(entry)),
    })
  } else {
    fs.copyFileSync(source, destination)
  }
}

console.log('[assets] SVGMap assets copied into public (no symlinks)')
