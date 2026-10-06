import { showPropertyModal } from '../svg3-bosai/representative-pins/propertyModal.js'

const HIT_INDEX_URL = './geometry/hit/index.json'
const SOURCE_URL = 'https://www.pref.okayama.jp/page/1036031.html'
const GIS_URL = 'https://www.gis.pref.okayama.jp/pref-okayama/PositionSelect?mid=5002'
const POLYGON_DETAIL_VIEW_WIDTH = 0.12
const POLYGON_OVERVIEW_VIEW_WIDTH = 0.45
const POLYGON_VERY_FAR_VIEW_WIDTH = 1.6
const ui = {
  filters: [...document.querySelectorAll('.typeFilter')],
  opacity: document.getElementById('opacityRange'), opacityValue: document.getElementById('opacityValue'),
  status: document.getElementById('statusMessage'),
  filtered: document.getElementById('filteredCount'), visible: document.getElementById('visibleCount'),
}
let initialized = false
let hitIndex
let hitFeatures = []
let clickHitFeatures = []
let hitLoadSignature = ''
let hitLoadToken = 0
const shardCache = new Map()
let svgMap
let svgImage
let layerID

window.addEventListener('layerWebAppReady', initialize)

async function initialize() {
  if (initialized) return
  initialized = true
  ;({ svgMap, svgImage, layerID } = window)
  ui.filters.forEach((filter) => filter.addEventListener('change', render))
  ui.opacity.addEventListener('input', applyOpacity)
  svgMap.setShowPoiProperty(showDetails, layerID)
  window.customHitTester = customHitTester
  window.preRenderFunction = render
  window.addEventListener('zoomPanMap', render)
  applyOpacity()
  try {
    const response = await fetch(HIT_INDEX_URL)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    hitIndex = await response.json()
    setStatus('取込済みの公式ポリゴンを表示中です', '')
    render()
  } catch (error) {
    console.error(error)
    setStatus(`区域情報を読み込めませんでした（${error.message}）`, 'error')
  }
}

function render() {
  if (!svgMap || !svgImage) return
  updatePolygonVisibility()
  updateCountsAndHitData()
}

function updatePolygonVisibility() {
  const enabled = enabledTypes()
  const width = Number(svgMap.getGeoViewBox?.()?.width)
  const detail = width <= POLYGON_DETAIL_VIEW_WIDTH
  const overview = width > POLYGON_DETAIL_VIEW_WIDTH && width <= POLYGON_OVERVIEW_VIEW_WIDTH
  const far = width > POLYGON_OVERVIEW_VIEW_WIDTH && width <= POLYGON_VERY_FAR_VIEW_WIDTH
  const veryFar = width > POLYGON_VERY_FAR_VIEW_WIDTH
  svgImage.getElementById('steepVeryFar').setAttribute('visibility', enabled.has('急傾斜') && veryFar ? 'visible' : 'hidden')
  svgImage.getElementById('debrisVeryFar').setAttribute('visibility', enabled.has('土石流') && veryFar ? 'visible' : 'hidden')
  svgImage.getElementById('steepFar').setAttribute('visibility', enabled.has('急傾斜') && far ? 'visible' : 'hidden')
  svgImage.getElementById('debrisFar').setAttribute('visibility', enabled.has('土石流') && far ? 'visible' : 'hidden')
  svgImage.getElementById('steepOverview').setAttribute('visibility', enabled.has('急傾斜') && overview ? 'visible' : 'hidden')
  svgImage.getElementById('debrisOverview').setAttribute('visibility', enabled.has('土石流') && overview ? 'visible' : 'hidden')
  svgImage.getElementById('steepPolygons').setAttribute('visibility', enabled.has('急傾斜') && detail ? 'visible' : 'hidden')
  svgImage.getElementById('debrisPolygons').setAttribute('visibility', enabled.has('土石流') && detail ? 'visible' : 'hidden')
}

function updateCountsAndHitData() {
  if (!hitIndex) return
  const enabled = enabledTypes()
  const total = hitIndex.shards.reduce((sum, shard) => sum + [...enabled]
    .reduce((subtotal, type) => subtotal + Number(shard.counts?.[type] || 0), 0), 0)
  ui.filtered.textContent = total.toLocaleString('ja-JP')
  const view = normalizedView(svgMap.getGeoViewBox?.())
  if (!view || view.east - view.west > POLYGON_DETAIL_VIEW_WIDTH) {
    hitLoadToken += 1
    hitLoadSignature = ''
    hitFeatures = []
    ui.visible.textContent = '拡大後'
    return
  }

  const selected = hitIndex.shards.filter((shard) => intersects(shard.bounds, view))
  const signature = selected.map((shard) => shard.url).join('|')
  if (signature === hitLoadSignature) {
    updateVisibleCount(enabled, view)
    return
  }
  hitLoadSignature = signature
  const token = ++hitLoadToken
  ui.visible.textContent = '読込中'
  Promise.all(selected.map(loadShard)).then((groups) => {
    if (token !== hitLoadToken) return
    hitFeatures = groups.flat()
    updateVisibleCount(enabledTypes(), normalizedView(svgMap.getGeoViewBox?.()))
  }).catch((error) => {
    if (token !== hitLoadToken) return
    console.error(error)
    hitFeatures = []
    ui.visible.textContent = '-'
    setStatus(`区域の選択情報を読み込めませんでした（${error.message}）`, 'error')
  })
}

async function loadShard(shard) {
  if (!shardCache.has(shard.url)) {
    shardCache.set(shard.url, fetch(shard.url).then(async (response) => {
      if (!response.ok) throw new Error(`${shard.url}: HTTP ${response.status}`)
      return (await response.json()).features || []
    }).catch((error) => {
      shardCache.delete(shard.url)
      throw error
    }))
  }
  return shardCache.get(shard.url)
}

function updateVisibleCount(enabled, view) {
  if (!view) return
  const count = hitFeatures.filter((feature) => enabled.has(feature.type) && intersects(feature.bounds, view)).length
  ui.visible.textContent = count.toLocaleString('ja-JP')
}

function customHitTester(position) {
  if (!hitIndex || !hitFeatures.length) return null
  const enabled = enabledTypes()
  const view = normalizedView(svgMap.getGeoViewBox?.())
  if (!view || view.east - view.west > POLYGON_DETAIL_VIEW_WIDTH) return null
  const mapPixels = Math.max(1, Number(window.parent?.innerWidth || window.innerWidth || 1))
  const tolerance = (view.east - view.west) / mapPixels * 6
  const hits = hitFeatures.filter((feature) => enabled.has(feature.type) &&
    featureContains(feature, Number(position.lng), Number(position.lat), tolerance))
  if (!position.isMapCenterHitTest) clickHitFeatures = hits
  return hits.length ? hits.map((feature) => feature.location || feature.siteNumber) : null
}

function featureContains(feature, lon, lat, tolerance) {
  const bounds = feature.bounds
  if (lon < bounds.west - tolerance || lon > bounds.east + tolerance ||
      lat < bounds.south - tolerance || lat > bounds.north + tolerance) return false
  return feature.rings.some((ring) => pointInRing(lon, lat, ring) || nearRing(lon, lat, ring, tolerance))
}

function pointInRing(lon, lat, ring) {
  let inside = false
  for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current, current += 1) {
    const [x1, y1] = ring[current]
    const [x2, y2] = ring[previous]
    if ((y1 > lat) !== (y2 > lat) && lon < (x2 - x1) * (lat - y1) / (y2 - y1) + x1) inside = !inside
  }
  return inside
}

function nearRing(lon, lat, ring, tolerance) {
  const limit = tolerance * tolerance
  for (let index = 0; index < ring.length; index += 1) {
    const [x1, y1] = ring[index]
    const [x2, y2] = ring[(index + 1) % ring.length]
    const dx = x2 - x1, dy = y2 - y1
    const lengthSquared = dx * dx + dy * dy
    const amount = lengthSquared ? Math.max(0, Math.min(1, ((lon - x1) * dx + (lat - y1) * dy) / lengthSquared)) : 0
    const nearestX = x1 + amount * dx, nearestY = y1 + amount * dy
    if ((lon - nearestX) ** 2 + (lat - nearestY) ** 2 <= limit) return true
  }
  return false
}

function showDetails(target) {
  const feature = clickHitFeatures[Number(target?.getAttribute('data-hitTestIndex'))]
  if (!feature) return
  const rows = [['箇所番号', feature.siteNumber], ['種別', feature.type], ['位置', feature.location],
    ['人家分類', feature.householdClass || '-'], ['情報時点', '令和7年度末']]
  const body = rows.map(([name, value]) => `<div class="svg3-property-row"><dt>${escapeHtml(name)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')
  showPropertyModal(`<article class="svg3-property svg3-property-warning svg3-property-webcam-compact">
    <header class="svg3-property-header"><p class="svg3-property-kind">岡山県 新たな土砂災害リスク箇所</p>
    <h2 class="svg3-property-title">${escapeHtml(feature.location)}</h2>
    <div class="svg3-property-status"><span class="svg3-property-dot"></span><span>未指定・調査候補</span></div></header>
    <dl class="svg3-property-body">${body}</dl><div class="svg3-property-actions svg3-property-actions-padded">
    <a class="svg3-property-link" href="${GIS_URL}" target="_blank" rel="noopener noreferrer">公式GISで確認</a></div></article>`,
  { attribution: { label: '岡山県 土木部 防災砂防課', url: SOURCE_URL } })
}

function normalizedView(view) {
  if (!view) return null
  const west = Number(view.x), south = Number(view.y)
  const width = Number(view.width), height = Number(view.height)
  if (![west, south, width, height].every(Number.isFinite)) return null
  return { west, south, east: west + width, north: south + height }
}
function intersects(a, b) {
  return a.east >= b.west && a.west <= b.east && a.north >= b.south && a.south <= b.north
}
function enabledTypes() { return new Set(ui.filters.filter((filter) => filter.checked).map((filter) => filter.value)) }
function applyOpacity() {
  svgImage?.getElementById('officialPolygons')?.setAttribute('opacity', String(Number(ui.opacity.value) / 100))
  ui.opacityValue.value = `${ui.opacity.value}%`; svgMap?.refreshScreen()
}
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]))
function setStatus(message, type) { ui.status.textContent = message; ui.status.className = `status${type ? ` ${type}` : ''}` }
