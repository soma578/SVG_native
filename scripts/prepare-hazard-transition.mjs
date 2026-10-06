import fs from 'node:fs'
import path from 'node:path'

// District files contain four very large compound paths. SVGMap
// replays every point on each repaint, even when only a small part is visible.
// Put a cheaper, still district-level shape in the thin wrapper and defer the
// original document until the viewport is narrower.
const DETAIL_ZOOM = 70
const GRID = 0.05
const MINIMUM_AREA = GRID * GRID
const GROUPS = {
  'hazard-flood': ['#3b82f6', '#1d4ed8', '0.28'],
  'hazard-tsunami-inundation': ['#a855f7', '#7e22ce', '0.28'],
  'hazard-landslide-warning': ['#f97316', '#c2410c', '0.32'],
  'hazard-landslide-special': ['#ef4444', '#991b1b', '0.35'],
}

function ringsOf(pathData) {
  const tokens = pathData.match(/[MLZ]|-?\d+(?:\.\d+)?/g) || []
  const rings = []
  let ring
  for (let index = 0; index < tokens.length;) {
    const command = tokens[index++]
    if (command === 'M') {
      if (ring?.length) rings.push(ring)
      ring = [[Number(tokens[index++]), Number(tokens[index++])]]
    } else if (command === 'L' && ring) {
      ring.push([Number(tokens[index++]), Number(tokens[index++])])
    } else if (command === 'Z') {
      if (ring?.length) rings.push(ring)
      ring = null
    } else {
      throw new Error(`Unsupported hazard path command: ${command}`)
    }
  }
  if (ring?.length) rings.push(ring)
  return rings
}

function simplifiedPath(source, id) {
  const group = source.match(new RegExp(`<g\\s+id="${id}"[^>]*>([\\s\\S]*?)<\\/g>`))
  if (!group) throw new Error(`Missing hazard group: ${id}`)
  const parts = []
  for (const [, pathData] of group[1].matchAll(/<path\b[^>]*\bd="([^"]*)"[^>]*\/?\s*>/g)) {
    for (const ring of ringsOf(pathData)) {
      const points = []
      for (const [x, y] of ring) {
        const next = [
          Number((Math.round(x / GRID) * GRID).toFixed(3)),
          Number((Math.round(y / GRID) * GRID).toFixed(3)),
        ]
        if (!points.length || points.at(-1)[0] !== next[0] || points.at(-1)[1] !== next[1]) {
          points.push(next)
        }
      }
      if (points.length > 1 && points[0][0] === points.at(-1)[0] && points[0][1] === points.at(-1)[1]) {
        points.pop()
      }
      if (points.length < 3) continue
      let area = 0
      for (let index = 0; index < points.length; index++) {
        const current = points[index]
        const next = points[(index + 1) % points.length]
        area += current[0] * next[1] - next[0] * current[1]
      }
      if (Math.abs(area) / 2 < MINIMUM_AREA) continue
      parts.push(`M${points[0].join(' ')}${points.slice(1).map((point) => `L${point.join(' ')}`).join('')}Z`)
    }
  }
  return parts.join('')
}

export function prepareHazardTransition(publicDir) {
  let count = 0
  let sourceBytes = 0
  let previewBytes = 0
  const districtRoot = path.join(publicDir, 'svgmapAppLayers/appLayers/svg3-bosai/hazard/districts')
  const prefectures = fs.readdirSync(districtRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{2}$/.test(entry.name))
    .map((entry) => entry.name)
  for (const prefecture of prefectures) {
    const wrapperDir = path.join(districtRoot, prefecture)
    for (const name of fs.readdirSync(wrapperDir).filter((entry) => entry.endsWith('.svg'))) {
      const wrapperPath = path.join(wrapperDir, name)
      const wrapper = fs.readFileSync(wrapperPath, 'utf8')
      const sourceUrl = wrapper.match(/<animation\b[^>]*\bid="hazard-source-\d+"[\s\S]*?\bhref="(\/map\/layers\/hazard\/[^\"]+\.svg)"/)?.[1]
      if (!sourceUrl) throw new Error(`Missing hazard source URL: ${wrapperPath}`)
      const sourcePath = path.join(publicDir, sourceUrl.slice(1))
      const source = fs.readFileSync(sourcePath, 'utf8')
      const preview = Object.entries(GROUPS).map(([id, [fill, stroke, opacity]]) => {
        const d = simplifiedPath(source, id)
        return `  <g id="${id}" visibleMaxZoom="${DETAIL_ZOOM * 100}" fill="${fill}" fill-opacity="${opacity}" stroke="${stroke}" stroke-opacity="0.7" stroke-width="0.1" pointer-events="none"><path fill-rule="evenodd" d="${d}"/></g>`
      }).join('\n')
      const updated = wrapper
        .replace(/(id="hazard-source-\d+"[\s\S]*?)( visibility="visible")/, `$1 visibleMinZoom="${DETAIL_ZOOM * 100}"$2`)
        .replace('</svg>', `${preview}\n</svg>`)
      if (updated === wrapper || !updated.includes(`visibleMinZoom="${DETAIL_ZOOM * 100}"`)) {
        throw new Error(`Failed to add hazard transition LOD: ${wrapperPath}`)
      }
      fs.writeFileSync(wrapperPath, updated)
      count++
      sourceBytes += Buffer.byteLength(source)
      previewBytes += Buffer.byteLength(preview)
    }
  }
  console.log(`[assets] hazard transition: ${count} districts in ${prefectures.length} prefectures, ${(sourceBytes / 1024 / 1024).toFixed(1)} MiB detail deferred, ${(previewBytes / 1024 / 1024).toFixed(1)} MiB previews`)
}
