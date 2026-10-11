import fs from 'node:fs'
import path from 'node:path'

const GRID = 25 // SVGMap's native coordinates are longitude/latitude × 100.
const TYPES = ['hazard-flood', 'hazard-tsunami-inundation', 'hazard-landslide-warning', 'hazard-landslide-special']
const DEFAULT_CITY_MIN_ZOOM = 1500
// Okayama uses original-boundary raster tiles through scale 70, then the
// original detailed SVG. Its simplified city-bundle tier is unnecessary.
const DETAIL_TILE_PREFECTURES = new Set(['33'])
const round = (value) => Number(value.toFixed(5))

function boundsOf(source, label) {
  const values = source.match(/viewBox="([^"]+)"/)?.[1]?.trim().split(/\s+/).map(Number)
  if (!values || values.length !== 4 || values.some((value) => !Number.isFinite(value))) {
    throw new Error(`Invalid hazard viewBox: ${label}`)
  }
  return { x: values[0], y: values[1], width: values[2], height: values[3] }
}

function groupsOf(source, label) {
  const output = {}
  for (const id of TYPES) {
    const match = source.match(new RegExp(`<g\\s+id="${id}"([^>]*)>([\\s\\S]*?)<\\/g>`))
    if (!match) throw new Error(`Missing ${id}: ${label}`)
    output[id] = { attributes: match[1].replace(/\s*visibleMaxZoom="[^"]*"/, ''), content: match[2] }
  }
  return output
}

function unionBounds(members) {
  const x = Math.min(...members.map(({ bounds }) => bounds.x))
  const y = Math.min(...members.map(({ bounds }) => bounds.y))
  const east = Math.max(...members.map(({ bounds }) => bounds.x + bounds.width))
  const south = Math.max(...members.map(({ bounds }) => bounds.y + bounds.height))
  return { x: round(x), y: round(y), width: round(east - x), height: round(south - y) }
}

export function prepareHazardCityBundles(publicDir) {
  const appRoot = path.join(publicDir, 'svgmapAppLayers/appLayers/svg3-bosai')
  const districtRoot = path.join(appRoot, 'hazard/districts')
  const outputRoot = path.join(appRoot, 'hazard-city-bundles/pref')
  let cityCount = 0
  let bundleCount = 0
  for (const prefecture of fs.readdirSync(districtRoot).filter((name) => /^\d{2}$/.test(name)).sort()) {
    const wrapperDir = path.join(districtRoot, prefecture)
    const buckets = new Map()
    for (const name of fs.readdirSync(wrapperDir).filter((entry) => entry.endsWith('.svg')).sort()) {
      const target = path.join(wrapperDir, name)
      const source = fs.readFileSync(target, 'utf8')
      const bounds = boundsOf(source, `${prefecture}/${name}`)
      const groups = groupsOf(source, `${prefecture}/${name}`)
      const column = Math.floor((bounds.x + bounds.width / 2) / GRID)
      const row = Math.floor((bounds.y + bounds.height / 2) / GRID)
      const key = `${column}-${row}`
      if (!buckets.has(key)) buckets.set(key, [])
      buckets.get(key).push({ bounds, groups })
      // At close zoom the original full-resolution source is used directly.
      const thin = source
        .replace(/  <g id="hazard-[^\n]*\n/g, '')
        .replace(' visibleMinZoom="7000"', '')
      fs.writeFileSync(target, thin)
      cityCount++
    }

    const prefPath = path.join(appRoot, 'hazard/pref', `${prefecture}.svg`)
    let prefSource = fs.readFileSync(prefPath, 'utf8')
    if (DETAIL_TILE_PREFECTURES.has(prefecture)) {
      prefSource = prefSource.replaceAll('visibleMinZoom="1500" visible-min-zoom="1500"', 'visibleMinZoom="9000" visible-min-zoom="9000"')
      fs.writeFileSync(prefPath, prefSource)
      continue
    }
    const animations = []
    for (const [key, members] of [...buckets].sort(([a], [b]) => a.localeCompare(b))) {
      const bounds = unionBounds(members)
      const groups = TYPES.map((id) => {
        const attributes = members[0].groups[id].attributes
        const content = members.map(({ groups: cityGroups }) => cityGroups[id].content).join('')
        return `  <g id="${id}"${attributes}>${content}</g>`
      }).join('\n')
      const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}" data-hazard-loading="city-bundle">\n  <globalCoordinateSystem srsName="http://purl.org/crs/84" transform="matrix(100,0,0,-100,0,0)" />\n${groups}\n</svg>\n`
      const filename = `${key}.svg`
      const target = path.join(outputRoot, prefecture, filename)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, svg)
      const href = `../../hazard-city-bundles/pref/${prefecture}/${filename}`
      animations.push(`  <animation id="hazard-city-bundle-${prefecture}-${key}" title="${prefecture} 市区町村概要" href="${href}" xlink:href="${href}" x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" visibleMinZoom="${DEFAULT_CITY_MIN_ZOOM}" visibleMaxZoom="6999.9" visibility="visible" />`)
      bundleCount++
    }
    const next = prefSource.replace('  <animation id="hazard-municipality-', `${animations.join('\n')}\n  <animation id="hazard-municipality-`)
      .replaceAll('visibleMinZoom="1500" visible-min-zoom="1500"', 'visibleMinZoom="7000" visible-min-zoom="7000"')
    if (next === prefSource || !next.includes('hazard-city-bundle-')) {
      throw new Error(`Could not add city bundles to prefecture ${prefecture}`)
    }
    fs.writeFileSync(prefPath, next)
  }
  console.log(`[assets] hazard city bundles: ${cityCount} municipalities → ${bundleCount} spatial documents`)
}
