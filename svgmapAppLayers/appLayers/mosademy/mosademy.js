import { showPropertyModal } from '../svg3-bosai/representative-pins/propertyModal.js'
import { CATALOG_URL, approvedDatasetUrl, normalizePublicData, facilityState } from './model.js'

const REFRESH_MS = 180_000
const FETCH_TIMEOUT_MS = 20_000
const ui = {
  reload: document.getElementById('reloadButton'),
  status: document.getElementById('statusMessage'),
  count: document.getElementById('facilityCount'),
  measuredAt: document.getElementById('measuredAt'),
  fetchedAt: document.getElementById('fetchedAt'),
}
const colors = { available: '#15803d', partial: '#a16207', unavailable: '#b91c1c', unknown: '#475569' }
const sensorLabels = { generator: '発電機の燃料残量', water: '水位残量', power: '電力' }
const expectedUnits = { generator: 'L', water: '%', power: 'W' }
let initialized = false
let loading = false
let facilities = []
let svgMap
let svgImage
let layerID

window.addEventListener('layerWebAppReady', initialize)
if (window.svgMap && window.svgImage) queueMicrotask(initialize)
let readinessChecks = 0
const readinessTimer = window.setInterval(() => {
  if (!initialized && window.svgMap && window.svgImage) void initialize()
  if (initialized || ++readinessChecks >= 50) window.clearInterval(readinessTimer)
}, 100)

async function initialize() {
  if (initialized || !window.svgMap || !window.svgImage) return
  initialized = true
  ;({ svgMap, svgImage, layerID } = window)
  ui.reload.addEventListener('click', loadData)
  svgMap.setShowPoiProperty(showFacilityProperty, layerID)
  await loadData()
  window.setInterval(() => {
    if (!document.hidden) void loadData()
  }, REFRESH_MS)
}

async function fetchJson(url, signal) {
  const response = await fetch(url, { cache: 'no-store', signal, credentials: 'omit' })
  if (!response.ok) throw new Error(`${new URL(url).pathname}: HTTP ${response.status}`)
  return response.json()
}

async function loadData() {
  if (loading) return
  loading = true
  ui.reload.disabled = true
  setStatus('公開データを取得しています', '')
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const catalog = await fetchJson(CATALOG_URL, controller.signal)
    const [latest, locations, cameras] = await Promise.all(
      ['latest', 'locations', 'cameras'].map((id) => fetchJson(approvedDatasetUrl(catalog, id), controller.signal)),
    )
    const data = normalizePublicData(catalog, latest, locations, cameras)
    facilities = data.facilities
    draw()
    ui.count.textContent = facilities.length.toLocaleString('ja-JP')
    ui.measuredAt.textContent = formatDate(latestMeasurement())
    ui.fetchedAt.textContent = formatDate(new Date().toISOString())
    const skipped = data.skippedRows ? `（関連付けられないデータ ${data.skippedRows}件）` : ''
    setStatus(facilities.length ? `${facilities.length}施設の公開データを表示しています${skipped}` : '公開施設の位置情報はありません', '')
  } catch (error) {
    console.error('[mosademy] public data load failed', error)
    if (facilities.length) draw()
    setStatus(`再取得に失敗しました。前回の表示を保持しています（${error.name === 'AbortError' ? '時間切れ' : error.message}）`, 'error')
  } finally {
    window.clearTimeout(timeout)
    loading = false
    ui.reload.disabled = false
  }
}

function latestMeasurement() {
  return facilities.reduce((latest, facility) =>
    facility.measuredAt && (!latest || Date.parse(facility.measuredAt) > Date.parse(latest))
      ? facility.measuredAt : latest, null)
}

function draw() {
  const fragment = svgImage.createDocumentFragment()
  facilities.forEach((facility, index) => {
    const [state] = facilityState(facility)
    const marker = svgImage.createElement('use')
    marker.setAttribute('xlink:href', `#facility-${state}`)
    marker.setAttribute('transform', `ref(svg,${(facility.lng * 100).toFixed(5)},${(-facility.lat * 100).toFixed(5)})`)
    marker.setAttribute('data-record-index', String(index))
    marker.setAttribute('data-feature-id', facility.id)
    marker.setAttribute('data-layer-id', 'mosademy')
    marker.setAttribute('data-kind', 'poi')
    marker.setAttribute('data-title', facility.name)
    marker.setAttribute('content', [facility.id, facility.name, state, facility.measuredAt || ''].map(csvSafe).join(','))
    marker.setAttribute('xlink:title', facility.name)
    marker.setAttribute('pointer-events', 'all')
    fragment.appendChild(marker)
  })
  svgImage.getElementById('facilityPoints').replaceChildren(fragment)
  svgMap.refreshScreen()
}

export function showFacilityProperty(target) {
  const facility = facilities[Number(target?.getAttribute('data-record-index'))]
  if (!facility) return
  const [state, stateLabel] = facilityState(facility)
  const rows = [
    ['施設ID', facility.id],
    ['最終計測', formatDate(facility.measuredAt)],
    ...facility.sensors.map((sensor) => {
      const label = sensorLabels[sensor.type]
      const unit = sensor.unit === expectedUnits[sensor.type] ? ` ${sensor.unit}` : ''
      const value = sensor.value === null ? '未取得' : `${sensor.value.toLocaleString('ja-JP')}${unit}`
      return [label, `${value} ／ ${statusLabel(sensor.status)} ／ ${formatDate(sensor.measuredAt)}`]
    }),
  ]
  const body = rows.map(([label, value]) => `<div class="svg3-property-row"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')
  const media = facility.cameras.map((camera) => `<div class="svg3-property-row svg3-property-media-row">
    <dt>${escapeHtml(camera.name)}</dt><dd><div class="svg3-property-media"><img src="${escapeHtml(camera.imageUrl)}" alt="${escapeHtml(camera.name)}" loading="lazy" referrerpolicy="no-referrer"></div>
    <span class="svg3-property-media-status">${escapeHtml(statusLabel(camera.status))} ／ 撮影 ${escapeHtml(formatDate(camera.measuredAt))}</span></dd></div>`).join('')
  return showPropertyModal(`<article class="svg3-property svg3-property-webcam-compact" style="--property-accent:${colors[state]}">
    <header class="svg3-property-header"><p class="svg3-property-kind">MOSAdemy 設備監視</p>
    <h2 class="svg3-property-title">${escapeHtml(facility.name)}</h2>
    <div class="svg3-property-status"><span class="svg3-property-dot"></span><span>${escapeHtml(stateLabel)}</span></div></header>
    <dl class="svg3-property-body">${body}${media}</dl></article>`,
  { attribution: { label: 'MOSAdemy 公開承認済みデータ' } })
}

function statusLabel(value) {
  return { normal: '正常', warning: '要確認', offline: 'オフライン', error: '異常', unknown: '状態不明' }[value] || '状態不明'
}
function formatDate(value) {
  const date = value ? new Date(value) : null
  return date && Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tokyo' }).format(date)
    : '-'
}
const csvSafe = (value) => String(value ?? '').replaceAll(',', '、').replaceAll('\n', ' ')
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g,
  (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))
function setStatus(message, type) {
  ui.status.textContent = message
  ui.status.className = `status${type ? ` ${type}` : ''}`
}
