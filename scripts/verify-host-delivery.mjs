import assert from 'node:assert/strict'
import fs from 'node:fs'

const swGenerator = fs.readFileSync('scripts/generate-upstream-sw.mjs', 'utf8')
const assetGenerator = fs.readFileSync('scripts/prepare-public-assets.mjs', 'utf8')
const page = fs.readFileSync('index.html', 'utf8')
const poiRenderer = fs.readFileSync('public/customShowPoiProperty.js', 'utf8')
const bootstrap = fs.readFileSync('public/svgmap-bootstrap.js', 'utf8')
const okayamaPropertyView = fs.readFileSync('public/okayama-property-view.js', 'utf8')
const container = fs.readFileSync('svgmapAppLayers/Container.svg', 'utf8')
const core = fs.readFileSync('svgmapjs/SVGMapLv0.1_Class_r18module.js', 'utf8')

assert(swGenerator.includes("url.pathname === '/api/cors-proxy'"),
  'The live CORS proxy must bypass Service Worker caches')
assert(swGenerator.includes("path.join(root, 'scripts/prepare-public-assets.mjs')"),
  'Changes to public-asset transforms must invalidate the Service Worker cache')
assert(swGenerator.includes("url.pathname === '/api/chugoku-outages'"),
  'The outage API must bypass Service Worker caches')
assert(swGenerator.includes("url.pathname === '/api/mizupigui'"),
  'The live water-stake API must bypass Service Worker caches')
assert(swGenerator.includes("relative.includes('/geometry/')")
  && swGenerator.includes("relative.endsWith('/candidates.json')")
  && swGenerator.includes("networkFirst(request, DYNAMIC_CACHE"),
  'Large Okayama geometry and point data must load and cache on demand')
assert(bootstrap.includes("[location.origin], true, true"),
  'Absolute same-origin URLs must bypass the CORS proxy')
assert(bootstrap.includes("import('/okayama-property-view.js')")
  && okayamaPropertyView.includes("OKAYAMA_PROPERTY_VIEW = 'svgmap'")
  && okayamaPropertyView.includes("mode === 'svgmap'"),
  'Okayama layers must use SVGMap properties by default while retaining the custom switch')
assert(bootstrap.includes("updateViaCache: 'none'")
  && !bootstrap.includes('location.reload()')
  && !swGenerator.includes('const SHELL_CACHE =')
  && !swGenerator.includes('const RUNTIME_CACHE =')
  && swGenerator.includes("if (request.mode === 'navigate')")
  && swGenerator.includes('All other same-origin assets'),
  'Application code and navigation must not use stale Service Worker shell/runtime caches or forced reloads')
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
assert(/title="酸素濃縮装置 最新ログ（山陽電子）"[^>]*visibility="hidden"/.test(container),
  'The sanitized oxygen-device snapshot must be registered as a hidden-by-default layer')
assert(container.includes('title="重ねるハザードマップALL"')
  && container.includes('xlink:href="./appLayers/mlitHazard/mlitHazard.svg"')
  && !container.includes('title="L4 ハザード(岡山大SVG3)"'),
  'Use the upstream SVGMap hazard layer instead of listing the duplicate custom L4 layer')
assert(fs.readFileSync('svgmapAppLayers/appLayers/mlitHazard/mlitHazard.html', 'utf8')
  .includes('dynamicWebTile.startBlank()'),
  'The upstream hazard selector must not request default local std tiles before selection')
for (const title of [
  '外部CSV現地情報',
  '酸素濃縮装置 最新ログ（山陽電子）',
  '水ピィ杭 最新状態（logpot）',
  'MOSAdemy 設備監視',
  '非常用電源・固体電池（デモ）',
  'ムービングハウス・利用状況（デモ）',
  '中国電力 停電情報・履歴（中国地方）',
  '岡山県 新たな土砂災害リスク箇所',
  '洪水・気象警報(岡山大SVG3)',
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

const hazardPublicRoot = 'public/svgmapAppLayers/appLayers/svg3-bosai/hazard/pref'
const okayamaHazard = fs.readFileSync(`${hazardPublicRoot}/33.svg`, 'utf8')
const hiroshimaHazard = fs.readFileSync(`${hazardPublicRoot}/34.svg`, 'utf8')
assert(!okayamaHazard.includes('hazard-city-bundle-')
  && okayamaHazard.includes('data-hazard-raster-tier="low" visibleMaxZoom="2999.9"')
  && okayamaHazard.includes('data-hazard-raster-tier="high" visibleMinZoom="3000"')
  && okayamaHazard.includes('hazard-detail-tiles/pref/33/')
  && [...okayamaHazard.matchAll(/<animation id="hazard-municipality-[^>]+visibleMinZoom="(\d+)"/g)]
    .every((match) => match[1] === '9000'),
  'Okayama must use high-resolution tiles until the original detailed SVG starts at scale 90')
const okayamaDistrict = fs.readFileSync('public/svgmapAppLayers/appLayers/svg3-bosai/hazard/districts/33/33101.svg', 'utf8')
const okayamaDetail = fs.readFileSync('public/map/layers/hazard/33/districts/33101.svg', 'utf8')
const originalOkayamaDetail = fs.readFileSync('map/layers/hazard/33/districts/33101.svg', 'utf8')
const pathData = (svg) => [...svg.matchAll(/<path\s+d="([^"]+)"/g)].map((match) => match[1])
assert(okayamaDistrict.includes('href="/map/layers/hazard/33/districts/33101.svg"')
  && !okayamaDistrict.includes('<path')
  && JSON.stringify(pathData(okayamaDetail)) === JSON.stringify(pathData(originalOkayamaDetail))
  && okayamaDetail.includes('stroke-width="0.012"')
  && okayamaDetail.includes('stroke-width="0.015"'),
  'Okayama detail must load the original district SVG, not a simplified preview')
assert([...hiroshimaHazard.matchAll(/<animation id="hazard-city-bundle-[^>]+visibleMinZoom="(\d+)"/g)]
  .every((match) => match[1] === '1500') && hiroshimaHazard.includes('hazard-city-bundle-'),
  'Other prefectures must retain the existing city-bundle transition')
const hazardController = fs.readFileSync('svgmapAppLayers/appLayers/svg3-bosai/hazard/hazardLayer.html', 'utf8')
assert(hazardController.includes('waiting: expected > 0 && missing && !deferred'),
  'Deferred city bundles must not trigger repeated readiness polling')
assert(hazardController.includes('documents[layerId]')
  && hazardController.includes('getSvgImagesProps?.()?.[rootHash]?.scale'),
  'Hazard controller must use the live root document and scale after zoom')

console.log('[host-delivery] network-only app shell, SW cache migration, same-origin bypass, BBS exclusion, local library, safe POI/UI hooks, custom layers, and backend state passed')
