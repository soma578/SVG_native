import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = path.join(root, 'public')
const markerPath = path.join(publicDir, '.svgmap-generated-assets.json')
const markerName = 'scripts/prepare-public-assets.mjs'
const excludedSourceRoots = [
  path.join(root, 'svgmapAppLayers', 'authoringLayers', 'bbs'),
]
const remoteLayerLib = 'https://cdn.jsdelivr.net/gh/svgmap/svgmapjs@latest/svgMapLayerLib.js'
const localLayerLib = '/svgmapjs/svgMapLayerLib.js'
const assets = [
  ['svgmap.html', 'index.html'],
  ['svgmapjs', 'svgmapjs'],
  ['svgmapAppLayers', 'svgmapAppLayers'],
  ['map', 'map'],
  ['sw.js', 'sw.js'],
]

fs.mkdirSync(publicDir, { recursive: true })

const isExcludedSource = (entry) => {
  const absolute = path.resolve(entry)
  return excludedSourceRoots.some((excluded) =>
    absolute === excluded || absolute.startsWith(`${excluded}${path.sep}`))
}

function localizeLayerLibrary(directory) {
  let replacements = 0
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      replacements += localizeLayerLibrary(filename)
      continue
    }
    if (!entry.isFile() || !/\.(?:html|js|svg)$/.test(entry.name)) continue
    const source = fs.readFileSync(filename, 'utf8')
    if (!source.includes(remoteLayerLib)) continue
    fs.writeFileSync(filename, source.replaceAll(remoteLayerLib, localLayerLib))
    replacements++
  }
  return replacements
}

let managed = false
if (fs.existsSync(markerPath)) {
  const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'))
  if (marker.managedBy !== markerName) {
    throw new Error(`Refusing to replace assets with an unknown marker: ${markerPath}`)
  }
  managed = true
}

// Validate every target before touching any generated asset location.
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
      filter: (entry) => !isExcludedSource(entry)
        && !['.git', '.next', 'node_modules'].includes(path.basename(entry)),
    })
    if (destName === 'svgmapAppLayers') {
      const replacements = localizeLayerLibrary(destination)
      console.log(`[assets] localized svgMapLayerLib.js in ${replacements} AppLayer files`)
    }
  } else {
    fs.copyFileSync(source, destination)
  }
}

console.log('[assets] SVGMap assets copied into public (no symlinks)')
