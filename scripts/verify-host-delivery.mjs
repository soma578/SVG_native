import assert from 'node:assert/strict'
import fs from 'node:fs'

const swGenerator = fs.readFileSync('scripts/generate-upstream-sw.mjs', 'utf8')
const assetGenerator = fs.readFileSync('scripts/prepare-public-assets.mjs', 'utf8')
const page = fs.readFileSync('index.html', 'utf8')
const poiRenderer = fs.readFileSync('public/customShowPoiProperty.js', 'utf8')
const container = fs.readFileSync('svgmapAppLayers/Container.svg', 'utf8')

assert(swGenerator.includes("url.pathname === '/api/cors-proxy'"),
  'The live CORS proxy must bypass Service Worker caches')
assert(assetGenerator.includes("'svgmapAppLayers', 'authoringLayers', 'bbs'"),
  'PHP-backed BBS authoring files must be excluded from public assets')
assert(assetGenerator.includes("const localLayerLib = '/svgmapjs/svgMapLayerLib.js'"),
  'AppLayers must use the local svgMapLayerLib.js snapshot')
assert(page.includes('id="vScale"') && page.includes('id="globalMessage"'),
  'The host page must expose SVGMap scale and LaWA message elements')
assert(page.includes('src="/customShowPoiProperty.js"')
  && poiRenderer.includes('window.svgMap.setShowPoiProperty(customShowPoiProperty)'),
  'The host page must register its safe POI renderer')
assert(!poiRenderer.includes('innerHTML'), 'The host POI renderer must not inject metadata as HTML')
assert(/title="eMAFF農地情報"[^>]*data-special-server-required|data-special-server-required[^>]*title="eMAFF農地情報"/.test(container),
  'eMAFF must be marked as requiring a dedicated backend')

console.log('[host-delivery] SW bypass, BBS exclusion, local library, safe POI/UI hooks, and backend marker passed')
