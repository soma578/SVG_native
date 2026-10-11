#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { styleOkayamaHazardDetail } from './hazard-detail-style.mjs'

// Mid-zoom raster made from the original (not simplified) Okayama boundaries.
// 96 source pixels per SVGMap unit keeps the image sharp until the detailed
// SVG takes over at scale 90. Small tiles keep browser decode memory bounded.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const wrapperPath = path.join(root, 'svgmapAppLayers/appLayers/svg3-bosai/hazard/pref/33.svg')
const districtSourceRoot = path.join(root, 'map/layers/hazard/33/districts')
const districtWrapperRoot = path.join(root, 'svgmapAppLayers/appLayers/svg3-bosai/hazard/districts/33')
const outputRoot = path.join(root, 'svgmapAppLayers/appLayers/svg3-bosai/hazard-detail-tiles')
const indexPath = path.join(outputRoot, 'index.json')
const checkOnly = process.argv.includes('--check')
const DENSITY = 96
const COLUMNS = 10
const ROWS = 10
const TYPES = {
  'hazard-flood': 'flood',
  'hazard-tsunami-inundation': 'tsunami',
  'hazard-landslide-warning': 'landslide-warning',
  'hazard-landslide-special': 'landslide-special',
}
const hash = (data) => crypto.createHash('sha256').update(data).digest('hex')
const round = (value) => Number(value.toFixed(8))
const wrapper = fs.readFileSync(wrapperPath, 'utf8')
const bounds = wrapper.match(/viewBox="([^"]+)"/)?.[1]?.trim().split(/\s+/).map(Number)
if (!bounds || bounds.length !== 4 || bounds.some((number) => !Number.isFinite(number))) {
  throw new Error('Invalid Okayama hazard source viewBox')
}
const [x, y, width, height] = bounds
const districts = fs.readdirSync(districtSourceRoot).filter((name) => name.endsWith('.svg')).sort().map((name) => {
  const source = fs.readFileSync(path.join(districtSourceRoot, name), 'utf8')
  const districtWrapper = fs.readFileSync(path.join(districtWrapperRoot, name), 'utf8')
  const values = districtWrapper.match(/viewBox="([^"]+)"/)?.[1]?.trim().split(/\s+/).map(Number)
  if (!values || values.length !== 4 || values.some((number) => !Number.isFinite(number))) {
    throw new Error(`Invalid district bounds: ${name}`)
  }
  const groups = Object.fromEntries(Object.entries(TYPES).map(([id, type]) => {
    const content = source.match(new RegExp(`<g\\s+id="${id}"[^>]*>[\\s\\S]*?<\\/g>`))?.[0]
    if (!content) throw new Error(`Missing hazard source group: ${name} ${id}`)
    return [type, content]
  }))
  return { name, bounds: values, groups, source, wrapper: districtWrapper }
})
const sourceHash = hash(wrapper + districts.map((district) => district.source + district.wrapper).join(''))
const styleHash = hash(fs.readFileSync(path.join(root, 'scripts/hazard-detail-style.mjs')))

if (checkOnly) {
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'))
  if (index.schemaVersion !== 1 || index.sourceHash !== sourceHash || index.styleHash !== styleHash || index.density !== DENSITY) {
    throw new Error('Okayama detail tiles are stale; run npm run data:hazard-detail-tiles')
  }
  for (const tile of index.tiles) {
    const file = path.join(outputRoot, tile.path)
    if (!fs.existsSync(file) || hash(fs.readFileSync(file)) !== tile.sha256) {
      throw new Error(`Missing or modified Okayama detail tile: ${tile.path}`)
    }
  }
  console.log(`[hazard-detail-tiles] verified ${index.tiles.length} Okayama tiles`)
  process.exit(0)
}

const imageWidth = Math.ceil(width * DENSITY)
const imageHeight = Math.ceil(height * DENSITY)
const index = {
  schemaVersion: 1,
  kind: 'svg3-hazard-detail-tiles',
  sourceHash,
  styleHash,
  density: DENSITY,
  prefecture: '33',
  bounds: { x, y, width, height },
  imageWidth,
  imageHeight,
  columns: COLUMNS,
  rows: ROWS,
  tiles: [],
}
for (const type of Object.values(TYPES)) {
  let count = 0
  for (let row = 0; row < ROWS; row++) {
    for (let column = 0; column < COLUMNS; column++) {
      const left = Math.floor(imageWidth * column / COLUMNS)
      const top = Math.floor(imageHeight * row / ROWS)
      const right = Math.floor(imageWidth * (column + 1) / COLUMNS)
      const bottom = Math.floor(imageHeight * (row + 1) / ROWS)
      const extract = { left, top, width: right - left, height: bottom - top }
      const tileX = x + width * left / imageWidth
      const tileY = y + height * top / imageHeight
      const tileWidth = width * extract.width / imageWidth
      const tileHeight = height * extract.height / imageHeight
      const members = districts.filter(({ bounds: [dx, dy, dw, dh] }) =>
        dx <= tileX + tileWidth && dx + dw >= tileX && dy <= tileY + tileHeight && dy + dh >= tileY)
      if (members.length === 0) continue
      const content = members.map((district) => styleOkayamaHazardDetail(district.groups[type])).join('')
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${extract.width}" height="${extract.height}" viewBox="${tileX} ${tileY} ${tileWidth} ${tileHeight}">${content}</svg>`
      const input = Buffer.from(svg)
      const stats = await sharp(input).stats()
      if (!stats.channels[3] || stats.channels[3].max === 0) continue
      const data = await sharp(input).webp({ lossless: true, effort: 4 }).toBuffer()
      const relative = `pref/33/${type}-${column}-${row}.webp`
      const file = path.join(outputRoot, relative)
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, data)
      index.tiles.push({
        type, path: relative,
        x: round(tileX),
        y: round(tileY),
        width: round(tileWidth),
        height: round(tileHeight),
        bytes: data.length,
        sha256: hash(data),
      })
      count++
    }
  }
  console.log(`[hazard-detail-tiles] ${type}: ${count} nonempty tiles`)
}
fs.mkdirSync(outputRoot, { recursive: true })
fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`)
const tileDir = path.join(outputRoot, 'pref/33')
const activeTiles = new Set(index.tiles.map((tile) => path.basename(tile.path)))
for (const name of fs.readdirSync(tileDir)) {
  if (/^(?:flood|tsunami|landslide-warning|landslide-special)-\d+-\d+\.webp$/.test(name)
    && !activeTiles.has(name)) fs.unlinkSync(path.join(tileDir, name))
}
console.log(`[hazard-detail-tiles] ${index.tiles.length} tiles at ${imageWidth}x${imageHeight} source resolution`)
