import assert from 'node:assert/strict'
import fs from 'node:fs'

const swGenerator = fs.readFileSync('scripts/generate-upstream-sw.mjs', 'utf8')
const assetGenerator = fs.readFileSync('scripts/prepare-public-assets.mjs', 'utf8')
const page = fs.readFileSync('index.html', 'utf8')
const poiRenderer = fs.readFileSync('public/customShowPoiProperty.js', 'utf8')
const bootstrap = fs.readFileSync('public/svgmap-bootstrap.js', 'utf8')
const container = fs.readFileSync('svgmapAppLayers/Container.svg', 'utf8')
const core = fs.readFileSync('svgmapjs/SVGMapLv0.1_Class_r18module.js', 'utf8')

assert(swGenerator.includes("url.pathname === '/api/cors-proxy'"),
  'The live CORS proxy must bypass Service Worker caches')
assert(swGenerator.includes("path.join(root, 'scripts/prepare-public-assets.mjs')"),
  'Changes to public-asset transforms must invalidate the Service Worker cache')
assert(swGenerator.includes("svgmapAppLayers/appLayers/oxygenDeviceLog/"),
  'The fixed oxygen-device snapshot must be available from the offline shell')
assert(swGenerator.includes("svgmapAppLayers/appLayers/chugokuOutages/")
  && swGenerator.includes("url.pathname === '/api/chugoku-outages'"),
  'The outage layer shell must be precached while its live API bypasses Service Worker caches')
assert(swGenerator.includes("svgmapAppLayers/appLayers/okayamaLandslideCandidates/"),
  'The Okayama landslide candidate snapshot must be available from the offline shell')
assert(bootstrap.includes("[location.origin], true, true"),
  'Absolute same-origin URLs must bypass the CORS proxy')
assert(core.includes('beforeElem && beforeElem.parentNode == parentElem')
  && core.includes('Array.from(parentElem.children).find(')
  && !core.includes('parentElem.insertBefore(img, childSpans.item(0))'),
  'Core rendering must not pass a nested descendant to insertBefore')
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
assert(!/title="eMAFF農地情報"[^>]*data-special-server-required|data-special-server-required[^>]*title="eMAFF農地情報"/.test(container),
  'eMAFF must use the fixed local backend')
assert(/title="海底ケーブル\(海しる\)"[^>]*data-external-api-changed/.test(container),
  'Retired MSIL layers must be identified as an external API change')
assert(/title="酸素濃縮装置 最新ログ"[^>]*visibility="hidden"/.test(container),
  'The sanitized oxygen-device snapshot must be registered as a hidden-by-default layer')
for (const title of [
  '外部CSV現地情報',
  '酸素濃縮装置 最新ログ',
  '中国電力 停電情報（岡山県）',
  '岡山県 新たな土砂災害リスク箇所',
  '洪水・気象警報(岡山大SVG3)',
  'L4 ハザード(岡山大SVG3)',
  'L2 避難所',
  '全国河川監視カメラ',
  'L3 チーム活動',
]) {
  const animation = [...container.matchAll(/<animation\b[^>]*>/g)]
    .map((match) => match[0])
    .find((tag) => tag.includes(`title="${title}"`))
  assert(animation?.includes('class="岡山大学'), `${title} must be listed under 岡山大学`)
}
const oxygenLayer = fs.readFileSync('svgmapAppLayers/appLayers/oxygenDeviceLog/oxygenDeviceLog.js', 'utf8')
const oxygenSvg = fs.readFileSync('svgmapAppLayers/appLayers/oxygenDeviceLog/oxygenDeviceLog.svg', 'utf8')
const oxygenIcons = fs.readdirSync('svgmapAppLayers/appLayers/oxygenDeviceLog/icons')
  .map((name) => fs.readFileSync(`svgmapAppLayers/appLayers/oxygenDeviceLog/icons/${name}`, 'utf8'))
assert(oxygenLayer.includes("from '../svg3-bosai/representative-pins/propertyModal.js'"),
  'The oxygen-device layer must use the shared SVG3 property modal')
assert(oxygenLayer.includes("data-layer-id', 'oxygenDeviceLog'")
  && oxygenSvg.includes('transform="matrix(100,0,0,-100,0,0)"')
  && oxygenSvg.includes('x="-13" y="-13" width="26" height="26"')
  && !oxygenLayer.includes('hilightStrokeStyle')
  && oxygenLayer.includes('svg3-property-webcam-compact')
  && oxygenIcons.every((icon) => !icon.includes('<text') && icon.includes('r="10.5"')),
  'The oxygen-device POIs and property card must follow the webcam visual and interaction contract')

console.log('[host-delivery] SW/cache invalidation, same-origin bypass, BBS exclusion, local library, safe POI/UI hooks, custom layers, and backend state passed')
