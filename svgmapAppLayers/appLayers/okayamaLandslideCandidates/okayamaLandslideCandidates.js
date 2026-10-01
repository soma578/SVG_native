import { showPropertyModal } from '../svg3-bosai/representative-pins/propertyModal.js'

const DATA_URL = './candidates.json'
const SOURCE_URL = 'https://www.pref.okayama.jp/page/1036031.html'
const GIS_URL = 'https://www.gis.pref.okayama.jp/pref-okayama/PositionSelect?mid=5002'
const ui = {
  filters: [...document.querySelectorAll('.typeFilter')], status: document.getElementById('statusMessage'),
  filtered: document.getElementById('filteredCount'), visible: document.getElementById('visibleCount'),
}
let initialized = false
let records = []
let drawnFeatures = []
let signature = ''
let svgMap
let svgImage
let layerID

window.addEventListener('layerWebAppReady', initialize)
async function initialize() {
  if (initialized) return
  initialized = true
  ;({ svgMap, svgImage, layerID } = window)
  ui.filters.forEach((filter) => filter.addEventListener('change', () => { signature = ''; draw() }))
  svgMap.setShowPoiProperty(showDetails, layerID)
  window.preRenderFunction = draw
  window.addEventListener('zoomPanMap', draw)
  try {
    const response = await fetch(DATA_URL)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    records = data.records || []
    setStatus(`${records.length.toLocaleString('ja-JP')}件を読み込みました`, '')
    draw()
  } catch (error) {
    console.error(error)
    setStatus(`データを読み込めませんでした（${error.message}）`, 'error')
  }
}

function draw() {
  if (!records.length || !svgImage) return
  const enabled = new Set(ui.filters.filter((filter) => filter.checked).map((filter) => filter.value))
  const filtered = records.filter((record) => enabled.has(record.type))
  const view = svgMap.getGeoViewBox?.()
  const visible = filtered.filter((record) => inView(record, view))
  const gridSize = Number(view?.width) > 0.8 ? 0.04 : Number(view?.width) > 0.3 ? 0.015 : 0
  const features = gridSize ? aggregate(visible, gridSize) : visible.map((record) => ({ ...record, count: 1, records: [record] }))
  const nextSignature = [enabled.size, ...enabled, Number(view?.x).toFixed(3), Number(view?.y).toFixed(3),
    Number(view?.width).toFixed(3), Number(view?.height).toFixed(3), features.length].join('|')
  ui.filtered.textContent = filtered.length.toLocaleString('ja-JP')
  ui.visible.textContent = features.length.toLocaleString('ja-JP')
  if (nextSignature === signature) return
  signature = nextSignature
  drawnFeatures = features
  const fragment = svgImage.createDocumentFragment()
  features.forEach((feature, index) => {
    const marker = svgImage.createElement('use')
    const icon = feature.type === '急傾斜' ? '#candidate-steep' : feature.type === '土石流' ? '#candidate-debris' : '#candidate-mixed'
    marker.setAttribute('xlink:href', icon)
    marker.setAttribute('transform', `ref(svg,${(feature.lon * 100).toFixed(5)},${(-feature.lat * 100).toFixed(5)})`)
    marker.setAttribute('data-record-index', String(index)); marker.setAttribute('data-feature-id', feature.id)
    marker.setAttribute('data-layer-id', 'okayamaLandslideCandidates'); marker.setAttribute('data-kind', 'risk-candidate')
    marker.setAttribute('data-title', feature.count > 1 ? `${feature.count}件の候補箇所` : feature.location)
    marker.setAttribute('content', [feature.siteNumber, feature.type, feature.location, feature.householdClass, '令和7年度末'].map(csvSafe).join(','))
    marker.setAttribute('xlink:title', feature.count > 1 ? `${feature.count}件` : feature.location); marker.setAttribute('pointer-events', 'all')
    fragment.appendChild(marker)
  })
  svgImage.getElementById('candidatePoints').replaceChildren(fragment)
  svgMap.refreshScreen()
}

function aggregate(items, size) {
  const cells = new Map()
  for (const item of items) {
    const key = `${Math.floor(item.lon / size)}:${Math.floor(item.lat / size)}`
    const cell = cells.get(key) || { records: [], lon: 0, lat: 0, types: new Set() }
    cell.records.push(item); cell.lon += item.lon; cell.lat += item.lat; cell.types.add(item.type); cells.set(key, cell)
  }
  return [...cells.entries()].map(([key, cell]) => ({
    id: `cluster-${key}`, count: cell.records.length, records: cell.records,
    lon: cell.lon / cell.records.length, lat: cell.lat / cell.records.length,
    type: cell.types.size === 1 ? [...cell.types][0] : '混在', location: '表示範囲内の集約点', siteNumber: '', householdClass: '',
  }))
}

function showDetails(target) {
  const feature = drawnFeatures[Number(target?.getAttribute('data-record-index'))]
  if (!feature) return
  const clustered = feature.count > 1
  const rows = clustered
    ? [['候補箇所数', `${feature.count.toLocaleString('ja-JP')}件`], ['内訳', summarizeTypes(feature.records)], ['表示', '縮尺を拡大すると個別の候補点を確認できます']]
    : [['箇所番号', feature.siteNumber], ['種別', feature.type], ['位置', feature.location], ['人家分類', feature.householdClass || '-'], ['情報時点', '令和7年度末']]
  const body = rows.map(([name, value]) => `<div class="svg3-property-row"><dt>${escapeHtml(name)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')
  showPropertyModal(`<article class="svg3-property svg3-property-warning svg3-property-webcam-compact">
    <header class="svg3-property-header"><p class="svg3-property-kind">新たな土砂災害リスク箇所</p>
    <h2 class="svg3-property-title">${escapeHtml(clustered ? `${feature.count}件の候補箇所` : feature.location)}</h2>
    <div class="svg3-property-status"><span class="svg3-property-dot"></span><span>未指定・調査候補</span></div></header>
    <dl class="svg3-property-body">${body}</dl><div class="svg3-property-actions svg3-property-actions-padded">
    <a class="svg3-property-link" href="${GIS_URL}" target="_blank" rel="noopener noreferrer">公式GISで確認</a></div></article>`,
  { attribution: { label: '岡山県 土木部 防災砂防課', url: SOURCE_URL } })
}

function inView(record, view) {
  if (!view) return true
  const left = Number(view.x), bottom = Number(view.y), right = left + Number(view.width), top = bottom + Number(view.height)
  return record.lon >= left && record.lon <= right && record.lat >= bottom && record.lat <= top
}
const summarizeTypes = (items) => ['急傾斜', '土石流'].map((type) => `${type} ${items.filter((item) => item.type === type).length}件`).join(' ／ ')
const csvSafe = (value) => String(value ?? '').replaceAll(',', '、').replaceAll('\n', ' ')
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]))
function setStatus(message, type) { ui.status.textContent = message; ui.status.className = `status${type ? ` ${type}` : ''}` }
