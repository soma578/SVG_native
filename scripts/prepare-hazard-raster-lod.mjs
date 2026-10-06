import fs from 'node:fs'
import path from 'node:path'

const TYPES = {
  flood: 'hazard-flood',
  tsunami: 'hazard-tsunami-inundation',
  'landslide-warning': 'hazard-landslide-warning',
  'landslide-special': 'hazard-landslide-special',
}
const CITY_MIN_ZOOM = 1500

export function prepareHazardRasterLod(publicDir) {
  const relativeRoot = 'svgmapAppLayers/appLayers/svg3-bosai/hazard-raster-tiles'
  const rasterRoot = path.join(publicDir, relativeRoot)
  const index = JSON.parse(fs.readFileSync(path.join(rasterRoot, 'index.json'), 'utf8'))
  if (index.schemaVersion !== 1 || Object.keys(index.prefectures).length !== 47) {
    throw new Error('Incomplete hazard raster tile index')
  }
  const prefRoot = path.join(publicDir, 'svgmapAppLayers/appLayers/svg3-bosai/hazard/pref')
  let count = 0
  for (const [code, entry] of Object.entries(index.prefectures)) {
    const target = path.join(prefRoot, `${code}.svg`)
    let source = fs.readFileSync(target, 'utf8')
    for (const [type, id] of Object.entries(TYPES)) {
      const images = entry.tiles.filter((tile) => tile.type === type).map((tile) => {
        const href = `/${relativeRoot}/${tile.path}`
        return `    <image href="${href}" xlink:href="${href}" x="${tile.x}" y="${tile.y}" width="${tile.width}" height="${tile.height}" pointer-events="none" />`
      })
      if (images.length !== 4) throw new Error(`Incomplete hazard tiles: ${code} ${type}`)
      const group = `  <g id="${id}" data-hazard-raster="true" visibleMinZoom="1000" visibility="visible" pointer-events="none">\n${images.join('\n')}\n  </g>`
      if (type === 'flood') {
        const next = source.replace(/  <animation id="hazard-vector-overview-\d\d"[\s\S]*?\/>/, group)
        if (next === source) throw new Error(`Missing prefecture overview: ${code}`)
        source = next
      } else {
        source = source.replace('  <animation id="hazard-municipality-', `${group}\n  <animation id="hazard-municipality-`)
      }
    }
    source = source.replaceAll('visibleMinZoom="3500"', `visibleMinZoom="${CITY_MIN_ZOOM}"`)
      .replaceAll('visible-min-zoom="3500"', `visible-min-zoom="${CITY_MIN_ZOOM}"`)
    fs.writeFileSync(target, source)
    count++
  }
  console.log(`[assets] hazard raster/city LOD: ${count} prefectures, raster <15, city shapes >=15`)
}
