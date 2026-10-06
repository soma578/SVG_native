#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = path.join(root, 'map/layers/hazard')
const wrapperRoot = path.join(root, 'svgmapAppLayers/appLayers/svg3-bosai/hazard/pref')
const outputRoot = path.join(root, 'svgmapAppLayers/appLayers/svg3-bosai/hazard-raster-tiles')
const checkOnly = process.argv.includes('--check')
const COLUMNS = 2
const ROWS = 2
const GROUPS = {
  'hazard-flood': 'flood',
  'hazard-tsunami-inundation': 'tsunami',
  'hazard-landslide-warning': 'landslide-warning',
  'hazard-landslide-special': 'landslide-special',
}

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex')
const round = (value) => Number(value.toFixed(8))
const parseViewBox = (source, label) => {
  const values = source.match(/viewBox="([^"]+)"/)?.[1]?.trim().split(/\s+/).map(Number)
  if (!values || values.length !== 4 || values.some((value) => !Number.isFinite(value))) {
    throw new Error(`Invalid prefecture bounds: ${label}`)
  }
  return { x: values[0], y: values[1], width: values[2], height: values[3] }
}

const sourceForPrefecture = (code) => {
  const directory = path.join(sourceRoot, String(Number(code)))
  const name = fs.readdirSync(directory).find((entry) => entry.endsWith('.svg'))
  if (!name) throw new Error(`Missing hazard source for prefecture ${code}`)
  return path.join(directory, name)
}

const inputs = fs.readdirSync(wrapperRoot).filter((name) => /^\d{2}\.svg$/.test(name)).sort()
if (inputs.length !== 47) throw new Error(`Expected 47 prefectures, found ${inputs.length}`)

const sourceHash = crypto.createHash('sha256')
const prefectures = inputs.map((name) => {
  const code = name.slice(0, 2)
  const wrapper = fs.readFileSync(path.join(wrapperRoot, name))
  const source = fs.readFileSync(sourceForPrefecture(code))
  sourceHash.update(code).update(wrapper).update(source)
  return { code, bounds: parseViewBox(wrapper.toString(), code), source: source.toString() }
})
const digest = sourceHash.digest('hex')
const indexPath = path.join(outputRoot, 'index.json')

if (checkOnly) {
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'))
  if (index.sourceHash !== digest || index.schemaVersion !== 1) {
    throw new Error('Hazard raster tiles are stale; run npm run data:hazard-raster-tiles')
  }
  for (const entry of Object.values(index.prefectures)) {
    for (const tile of entry.tiles) {
      if (!fs.existsSync(path.join(outputRoot, tile.path))) {
        throw new Error(`Missing hazard raster tile: ${tile.path}`)
      }
      if (sha256(fs.readFileSync(path.join(outputRoot, tile.path))) !== tile.sha256) {
        throw new Error(`Modified hazard raster tile: ${tile.path}`)
      }
    }
  }
  console.log(`[hazard-raster-tiles] verified ${Object.keys(index.prefectures).length} prefectures`)
  process.exit(0)
}

fs.mkdirSync(outputRoot, { recursive: true })
const index = {
  schemaVersion: 1,
  kind: 'svg3-hazard-raster-tiles',
  sourceHash: digest,
  columns: COLUMNS,
  rows: ROWS,
  prefectures: {},
}
let count = 0
let bytes = 0
for (const { code, bounds, source } of prefectures) {
  // The normal prefecture tile is at least ~1 pixel / 50 m. Disconnected
  // island prefectures get a larger canvas, capped to avoid huge image memory.
  const longest = Math.max(bounds.width, bounds.height)
  const longSide = longest <= 250 ? 4096 : 8192
  const aspect = bounds.width / bounds.height
  const imageWidth = aspect >= 1 ? longSide : Math.max(1, Math.round(longSide * aspect))
  const imageHeight = aspect >= 1 ? Math.max(1, Math.round(longSide / aspect)) : longSide
  const entry = { bounds, width: imageWidth, height: imageHeight, tiles: [] }

  for (const [id, type] of Object.entries(GROUPS)) {
    const group = source.match(new RegExp(`<g\\s+id="${id}"[^>]*>[\\s\\S]*?<\\/g>`))?.[0]
    if (!group) throw new Error(`Missing ${id} in prefecture ${code}`)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${imageWidth}" height="${imageHeight}" viewBox="${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}">${group}</svg>`
    const bitmap = await sharp(Buffer.from(svg)).png().toBuffer()
    for (let row = 0; row < ROWS; row++) {
      for (let column = 0; column < COLUMNS; column++) {
        const left = Math.floor(imageWidth * column / COLUMNS)
        const top = Math.floor(imageHeight * row / ROWS)
        const right = Math.floor(imageWidth * (column + 1) / COLUMNS)
        const bottom = Math.floor(imageHeight * (row + 1) / ROWS)
        const buffer = await sharp(bitmap)
          .extract({ left, top, width: right - left, height: bottom - top })
          .webp({ lossless: true, effort: 4 })
          .toBuffer()
        const relative = `pref/${code}/${type}-${column}-${row}.webp`
        const target = path.join(outputRoot, relative)
        fs.mkdirSync(path.dirname(target), { recursive: true })
        fs.writeFileSync(target, buffer)
        entry.tiles.push({
          type,
          path: relative,
          x: round(bounds.x + bounds.width * left / imageWidth),
          y: round(bounds.y + bounds.height * top / imageHeight),
          width: round(bounds.width * (right - left) / imageWidth),
          height: round(bounds.height * (bottom - top) / imageHeight),
          bytes: buffer.length,
          sha256: sha256(buffer),
        })
        count++
        bytes += buffer.length
      }
    }
  }
  index.prefectures[code] = entry
  console.log(`[hazard-raster-tiles] ${code}: ${imageWidth}x${imageHeight}, ${entry.tiles.length} tiles`)
}
fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`)
console.log(`[hazard-raster-tiles] generated ${count} tiles, ${(bytes / 1024 / 1024).toFixed(1)} MiB`)
