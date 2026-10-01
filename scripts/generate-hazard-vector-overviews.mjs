#!/usr/bin/env node

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = path.join(root, 'map/layers/hazard')
const outputRoot = path.join(root, 'svgmapAppLayers/appLayers/svg3-bosai/hazard-vector-overview')
const checkOnly = process.argv.includes('--check')

const NATIONAL_BOUNDS = Object.freeze({ x: 12243.4, y: -4605.6, width: 3205.3, height: 2251 })
const LEVELS = Object.freeze({
  national: Object.freeze({ grid: 1.5, minimumArea: 2.25 }),
  prefecture: Object.freeze({ grid: 0.25, minimumArea: 0.0625 }),
})
const TYPES = Object.freeze({
  'hazard-flood': Object.freeze({ fill: '#3b82f6', fillOpacity: '0.32', stroke: '#1d4ed8' }),
  'hazard-tsunami-inundation': Object.freeze({ fill: '#a855f7', fillOpacity: '0.32', stroke: '#7e22ce' }),
  'hazard-landslide-warning': Object.freeze({ fill: '#f97316', fillOpacity: '0.34', stroke: '#c2410c' }),
  'hazard-landslide-special': Object.freeze({ fill: '#ef4444', fillOpacity: '0.38', stroke: '#991b1b' }),
})

const round = (value) => Number(value.toFixed(3))
const pointKey = ([x, y]) => `${x},${y}`
const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])

const parseViewBox = (source, label) => {
  const match = source.match(/viewBox="\s*([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)\s*"/)
  if (!match) throw new Error(`Missing viewBox: ${label}`)
  const [, x, y, width, height] = match.map(Number)
  return { x, y, width, height }
}

const extractGroupPaths = (source, id) => {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const group = source.match(new RegExp(`<g\\s+id="${escaped}"[^>]*>([\\s\\S]*?)<\\/g>`))
  if (!group) throw new Error(`Missing group: ${id}`)
  return [...group[1].matchAll(/<path\b[^>]*\bd="([^"]*)"[^>]*\/?\s*>/g)].map((match) => match[1])
}

const parseRings = (pathData) => {
  const tokens = pathData.match(/[MLZ]|-?\d+(?:\.\d+)?/g) || []
  const rings = []
  let ring = null
  for (let index = 0; index < tokens.length;) {
    const command = tokens[index++]
    if (command === 'M' || command === 'L') {
      const point = [Number(tokens[index++]), Number(tokens[index++])]
      if (command === 'M') {
        if (ring?.length) rings.push(ring)
        ring = [point]
      } else if (ring) {
        ring.push(point)
      }
    } else if (command === 'Z') {
      if (ring?.length) rings.push(ring)
      ring = null
    } else {
      throw new Error(`Unsupported SVG path command: ${command}`)
    }
  }
  if (ring?.length) rings.push(ring)
  return rings
}

const simplifyRing = (points, { grid, minimumArea }) => {
  const snapped = []
  for (const [x, y] of points) {
    const point = [round(Math.round(x / grid) * grid), round(Math.round(y / grid) * grid)]
    if (!snapped.length || pointKey(point) !== pointKey(snapped.at(-1))) snapped.push(point)
  }
  if (snapped.length > 1 && pointKey(snapped[0]) === pointKey(snapped.at(-1))) snapped.pop()
  if (snapped.length < 3) return null

  let changed = true
  while (changed && snapped.length >= 3) {
    changed = false
    for (let index = 0; index < snapped.length; index += 1) {
      const previous = snapped[(index - 1 + snapped.length) % snapped.length]
      const current = snapped[index]
      const next = snapped[(index + 1) % snapped.length]
      if (Math.abs(cross(previous, current, next)) < 1e-9) {
        snapped.splice(index, 1)
        changed = true
        break
      }
    }
  }
  if (snapped.length < 3) return null

  let twiceArea = 0
  for (let index = 0; index < snapped.length; index += 1) {
    const [x1, y1] = snapped[index]
    const [x2, y2] = snapped[(index + 1) % snapped.length]
    twiceArea += x1 * y2 - x2 * y1
  }
  if (Math.abs(twiceArea) / 2 < minimumArea) return null
  return snapped
}

const compactPath = (rings) => rings.map((ring) => {
  const [[firstX, firstY], ...rest] = ring
  return `M${firstX} ${firstY}${rest.map(([x, y]) => `L${x} ${y}`).join('')}Z`
}).join('')

const simplifyType = (sources, id, level) => {
  const rings = []
  for (const source of sources) {
    for (const pathData of extractGroupPaths(source, id)) {
      for (const ring of parseRings(pathData)) {
        const simplified = simplifyRing(ring, level)
        if (simplified) rings.push(simplified)
      }
    }
  }
  return { path: compactPath(rings), rings: rings.length }
}

const svg = ({ title, bounds, sources, level }) => {
  const groups = []
  const counts = {}
  for (const [id, style] of Object.entries(TYPES)) {
    const simplified = simplifyType(sources, id, level)
    counts[id] = simplified.rings
    groups.push(`  <g id="${id}" fill="${style.fill}" fill-opacity="${style.fillOpacity}" stroke="${style.stroke}" stroke-opacity="0.9" stroke-width="${level.grid / 4}" pointer-events="none">\n    <path fill-rule="evenodd" d="${simplified.path}" />\n  </g>`)
  }
  const content = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}" pointer-events="none" data-hazard-overview="quantized-vector">\n  <title>${title}</title>\n  <globalCoordinateSystem srsName="http://purl.org/crs/84" transform="matrix(100,0,0,-100,0,0)" />\n${groups.join('\n')}\n</svg>\n`
  return { content, counts }
}

const sourceFiles = fs.readdirSync(sourceRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && /^\d{1,2}$/.test(entry.name))
  .map((entry) => {
    const directory = path.join(sourceRoot, entry.name)
    const file = fs.readdirSync(directory)
      .filter((name) => name.endsWith('.svg'))
      .sort()
      .map((name) => path.join(directory, name))
      .find((candidate) => fs.statSync(candidate).isFile())
    if (!file) throw new Error(`Missing prefecture source: ${entry.name}`)
    return { prefCode: entry.name.padStart(2, '0'), file, source: fs.readFileSync(file, 'utf8') }
  })
  .sort((a, b) => a.prefCode.localeCompare(b.prefCode))

if (sourceFiles.length !== 47) throw new Error(`Expected 47 prefectures, found ${sourceFiles.length}`)

const outputs = []
const national = svg({
  title: '全国 L4ハザード概要',
  bounds: NATIONAL_BOUNDS,
  sources: sourceFiles.map(({ source }) => source),
  level: LEVELS.national,
})
outputs.push({ relative: 'national.svg', ...national })

for (const { prefCode, source } of sourceFiles) {
  outputs.push({
    relative: `pref/${prefCode}.svg`,
    ...svg({
      title: `${prefCode} L4ハザード概要`,
      bounds: parseViewBox(source, prefCode),
      sources: [source],
      level: LEVELS.prefecture,
    }),
  })
}

const index = {
  schemaVersion: 1,
  kind: 'svg3-hazard-quantized-vector-overviews',
  sourceHash: crypto.createHash('sha256').update(sourceFiles.map(({ source }) => source).join('\n')).digest('hex'),
  levels: LEVELS,
  files: {},
}

for (const output of outputs) {
  const buffer = Buffer.from(output.content)
  index.files[output.relative] = {
    bytes: buffer.byteLength,
    sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
    rings: output.counts,
  }
  const target = path.join(outputRoot, output.relative)
  if (checkOnly) {
    if (!fs.existsSync(target) || !fs.readFileSync(target).equals(buffer)) {
      throw new Error(`Outdated generated hazard overview: ${output.relative}`)
    }
  } else {
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, buffer)
  }
}

const indexContent = `${JSON.stringify(index, null, 2)}\n`
const indexTarget = path.join(outputRoot, 'index.json')
if (checkOnly) {
  if (!fs.existsSync(indexTarget) || fs.readFileSync(indexTarget, 'utf8') !== indexContent) {
    throw new Error('Outdated generated hazard overview index')
  }
} else {
  fs.mkdirSync(outputRoot, { recursive: true })
  fs.writeFileSync(indexTarget, indexContent)
}

const totalBytes = outputs.reduce((sum, output) => sum + Buffer.byteLength(output.content), 0)
console.log(`[hazard-vector-overview] ${checkOnly ? 'verified' : 'generated'} ${outputs.length} SVGs, ${(totalBytes / 1024 / 1024).toFixed(1)} MiB`)
