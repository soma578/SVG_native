import fs from 'node:fs'
import path from 'node:path'

export const MESHES = ['5133', '5134', '5233', '5234', '5333', '5334']

export function parseTile(tsv) {
  return tsv.split(/\r?\n/).flatMap((line) => {
    if (!line.trim()) return []
    const fields = line.split('\t')
    const id = Number(fields[0])
    const lat = Number(fields[3])
    const lng = Number(fields[4])
    if (fields.length < 18 || !Number.isSafeInteger(id) || id < 1 || !Number.isFinite(lat) || !Number.isFinite(lng)) return []
    return [{ id, lat, lng, confirm: Number(fields[5]), diversion: Number(fields[6]), avail: Number(fields[7]),
      alwaysAvail: fields[8] === '1', hours: fields.slice(9, 17).map((value) => /^\d{8}$/.test(value) ? value : '00000000') }]
  })
}

function ringsFromPathData(d) {
  const tokens = d.match(/[MLZ]|-?\d+(?:\.\d+)?/gi) || []
  const rings = []
  let ring = []
  for (let i = 0; i < tokens.length;) {
    const token = tokens[i++]?.toUpperCase()
    if (token === 'M' || token === 'L') {
      const x = Number(tokens[i++]); const y = Number(tokens[i++])
      if (token === 'M' && ring.length) { rings.push(ring); ring = [] }
      if (Number.isFinite(x) && Number.isFinite(y)) ring.push([x, y])
    } else if (token === 'Z' && ring.length) { rings.push(ring); ring = [] }
  }
  if (ring.length) rings.push(ring)
  return rings.filter((points) => points.length >= 3).map((points) => ({
    points, minX: Math.min(...points.map((p) => p[0])), maxX: Math.max(...points.map((p) => p[0])),
    minY: Math.min(...points.map((p) => p[1])), maxY: Math.max(...points.map((p) => p[1])),
  }))
}

export function loadOkayamaBoundary(root) {
  const dir = path.join(root, 'map/data/districts/okayama/districts-svg')
  const rings = []
  for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.svg'))) {
    const svg = fs.readFileSync(path.join(dir, file), 'utf8')
    for (const match of svg.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)) rings.push(...ringsFromPathData(match[1]))
  }
  return rings
}

function inRing(x, y, ring) {
  if (x < ring.minX || x > ring.maxX || y < ring.minY || y > ring.maxY) return false
  let inside = false
  const points = ring.points
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j]
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside
  }
  return inside
}

export function inOkayama(lat, lng, rings) {
  return rings.some((ring) => inRing(lng, lat, ring))
}
