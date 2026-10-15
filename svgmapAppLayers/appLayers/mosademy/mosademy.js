// Keep MOSAdemy's approved-data loader and sensor renderer. HLMap groups the
// returned sensors by facility so one location has one pin and detail buttons.
import { loadApprovedSensors, showSensor } from 'https://mosa-github.github.io/data_test_server_page/assets/svgmap-data.js'
import { showPropertyModal } from '../svg3-bosai/representative-pins/propertyModal.js'
import { groupByFacility } from './view-model.js'
import { registerOkayamaPropertyView } from '/okayama-property-view.js'

const REFRESH_MS = 180_000
const ui = {
  reload: document.getElementById('reloadButton'),
  status: document.getElementById('statusMessage'),
  facilityCount: document.getElementById('facilityCount'),
  sensorCount: document.getElementById('sensorCount'),
  measuredAt: document.getElementById('measuredAt'),
  fetchedAt: document.getElementById('fetchedAt'),
}
let initialized = false
let loading = false
let facilities = []
let svgMap
let svgImage
let layerID

window.addEventListener('layerWebAppReady', initialize)
const sandboxIsReady = () => window.svgMap?.constructor?.name !== 'SandboxSvgMap'
if (window.svgMap && window.svgImage && sandboxIsReady()) queueMicrotask(initialize)
let readinessChecks = 0
const readinessTimer = window.setInterval(() => {
  if (!initialized && window.svgMap && window.svgImage && sandboxIsReady()) void initialize()
  if (initialized || ++readinessChecks >= 50) window.clearInterval(readinessTimer)
}, 100)

async function initialize() {
  if (initialized || !window.svgMap || !window.svgImage) return
  initialized = true
  ;({ svgMap, svgImage, layerID } = window)
  ui.reload.addEventListener('click', loadData)
  registerOkayamaPropertyView(svgMap, showFacilityProperty, layerID)
  await loadData()
  window.setInterval(() => {
    if (!document.hidden) void loadData()
  }, REFRESH_MS)
}

async function loadData() {
  if (loading) return
  loading = true
  ui.reload.disabled = true
  setStatus('先方の公開データを取得しています', '')
  try {
    const sensors = await loadApprovedSensors()
    const nextFacilities = groupByFacility(sensors)
    draw(nextFacilities)
    facilities = nextFacilities
    ui.facilityCount.textContent = facilities.length.toLocaleString('ja-JP')
    ui.sensorCount.textContent = facilities.reduce((count, facility) => count + facility.sensors.length, 0).toLocaleString('ja-JP')
    ui.measuredAt.textContent = formatDate(latestMeasurement())
    ui.fetchedAt.textContent = formatDate(new Date().toISOString())
    setStatus(facilities.length ? `${facilities.length}施設の公開データを表示しています` : '表示できる公開施設はありません', '')
  } catch (error) {
    console.error('[mosademy] public data load failed', error)
    setStatus(`再取得に失敗しました。前回の表示を保持しています（${error.message}）`, 'error')
  } finally {
    loading = false
    ui.reload.disabled = false
  }
}

function draw(nextFacilities) {
  const fragment = svgImage.createDocumentFragment()
  nextFacilities.forEach((facility, index) => {
    const marker = svgImage.createElement('image')
    marker.setAttribute('href', './icons/available.svg')
    marker.setAttribute('x', '-12')
    marker.setAttribute('y', '-12')
    marker.setAttribute('width', '24')
    marker.setAttribute('height', '24')
    marker.setAttribute('transform', `ref(svg,${facility.lng},${-facility.lat})`)
    marker.setAttribute('data-record-index', String(index))
    marker.setAttribute('data-facility-id', facility.id)
    marker.setAttribute('title', facility.name)
    const sensorValue = (type) => {
      const sensor = facility.sensors.find((item) => item.type === type)
      return sensor?.value == null ? '-' : `${sensor.value}${sensor.unit ? ` ${sensor.unit}` : ''}`
    }
    const cameraImages = facility.sensors.flatMap((item) => item.cameras || [])
    const measuredAt = facility.sensors.reduce((latest, sensor) =>
      sensor.updated_at && (!latest || Date.parse(sensor.updated_at) > Date.parse(latest))
        ? sensor.updated_at : latest, null)
    marker.setAttribute('content', [facility.id, facility.name, sensorValue('generator'),
      sensorValue('water'), sensorValue('power'), cameraImages[0]?.image_url || '-',
      cameraImages[1]?.image_url || '-',
      formatDate(measuredAt)].map(csvSafe).join(','))
    fragment.appendChild(marker)
  })
  svgImage.getElementById('sensor-root').replaceChildren(fragment)
  svgMap.refreshScreen()
}

function latestMeasurement() {
  return facilities.flatMap((facility) => facility.sensors)
    .reduce((latest, sensor) => sensor.updated_at && (!latest || Date.parse(sensor.updated_at) > Date.parse(latest))
      ? sensor.updated_at : latest, null)
}

export function showFacilityProperty(target) {
  const facility = facilities[Number(target?.getAttribute('data-record-index'))]
  if (!facility) return
  // S-LaWA forwards modal HTML to the embedding map, but cannot forward
  // event listeners attached here. Native <details> works in either origin.
  const details = facility.sensors.map((sensor, index) => {
    const supplierView = document.createElement('div')
    showSensor(supplierView, sensor)
    const description = supplierView.querySelector('p')?.textContent || '表示できるデータはありません'
    const images = [...supplierView.querySelectorAll('img')].flatMap((image) => {
      try {
        const url = new URL(image.src)
        if (url.protocol !== 'https:') return []
        return `<div class="svg3-property-media"><img src="${escapeHtml(url.href)}" alt="${escapeHtml(image.alt)}" loading="lazy" referrerpolicy="no-referrer"></div>`
      } catch { return [] }
    }).join('')
    return `<details class="mosademy-sensor" data-sensor-index="${index}"${index === 0 ? ' open' : ''}
      style="border:1px solid #cbd5e1;border-radius:8px;background:#fff;overflow:hidden">
      <summary style="padding:9px 11px;cursor:pointer;font-weight:600;color:#24364b">${escapeHtml(sensor.name || sensor.id)}</summary>
      <div class="mosademy-detail" style="padding:4px 11px 11px;white-space:pre-wrap">${escapeHtml(description)}${images}</div>
    </details>`
  }).join('')
  return showPropertyModal(`<article class="svg3-property svg3-property-webcam-compact">
    <header class="svg3-property-header"><p class="svg3-property-kind">MOSAdemy 設備監視</p>
    <h2 class="svg3-property-title">${escapeHtml(facility.name)}</h2>
    <div class="svg3-property-status"><span class="svg3-property-dot"></span><span>${facility.sensors.length}項目</span></div></header>
    <div class="svg3-property-body"><div class="svg3-property-row" style="display:block">
      <div class="mosademy-sensors" style="display:grid;gap:8px">${details}</div>
    </div></div>
    </article>`, { attribution: { label: 'MOSAdemy 公開承認済みデータ' } })
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
