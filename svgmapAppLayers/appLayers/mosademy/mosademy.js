// Keep MOSAdemy's approved-data loader and sensor renderer. HLMap groups the
// returned sensors by facility so one location has one pin and detail buttons.
import { loadApprovedSensors, showSensor } from 'https://mosa-github.github.io/data_test_server_page/assets/svgmap-data.js'
import { showPropertyModal } from '../svg3-bosai/representative-pins/propertyModal.js'
import { groupByFacility } from './view-model.js'

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
    const camera = facility.sensors.find((item) => item.cameras?.length)
    const measuredAt = facility.sensors.reduce((latest, sensor) =>
      sensor.updated_at && (!latest || Date.parse(sensor.updated_at) > Date.parse(latest))
        ? sensor.updated_at : latest, null)
    marker.setAttribute('content', [facility.id, facility.name, sensorValue('generator'),
      sensorValue('water'), sensorValue('power'), camera?.cameras?.[0]?.image_url || camera?.name || '-',
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
  const buttons = facility.sensors.map((sensor, index) =>
    `<button type="button" data-sensor-index="${index}" aria-pressed="false">${escapeHtml(sensor.name || sensor.id)}</button>`).join('')
  const info = showPropertyModal(`<article class="svg3-property svg3-property-webcam-compact">
    <header class="svg3-property-header"><p class="svg3-property-kind">MOSAdemy 設備監視</p>
    <h2 class="svg3-property-title">${escapeHtml(facility.name)}</h2>
    <div class="svg3-property-status"><span class="svg3-property-dot"></span><span>${facility.sensors.length}項目</span></div></header>
    <div class="svg3-property-actions svg3-property-actions-padded" role="group" aria-label="表示する項目を選択"
      style="grid-template-columns:repeat(2,minmax(0,1fr));padding:12px 17px 6px">${buttons}</div>
    <div class="svg3-property-body"><div class="svg3-property-row mosademy-detail" aria-live="polite"></div></div>
    </article>`, { attribution: { label: 'MOSAdemy 公開承認済みデータ' } })
  if (!info) return info
  const buttonNodes = [...info.querySelectorAll('[data-sensor-index]')]
  buttonNodes.forEach((button, index) => button.addEventListener('click', () => {
    renderSelectedSensor(info, facility.sensors[index])
    buttonNodes.forEach((node) => {
      const selected = node === button
      node.setAttribute('aria-pressed', String(selected))
      node.style.background = selected ? '#e5f1eb' : '#fff'
    })
  }))
  buttonNodes[0]?.click()
  return info
}

function renderSelectedSensor(info, sensor) {
  const supplierView = document.createElement('div')
  showSensor(supplierView, sensor)
  const detail = info.querySelector('.mosademy-detail')
  const doc = detail.ownerDocument
  const label = doc.createElement('dt')
  label.textContent = sensor.name || sensor.id
  const value = doc.createElement('dd')
  value.textContent = supplierView.querySelector('p')?.textContent || '表示できるデータはありません'
  detail.replaceChildren(label, value)
  for (const supplierImage of supplierView.querySelectorAll('img')) {
    const media = doc.createElement('div')
    media.className = 'svg3-property-media'
    const image = doc.createElement('img')
    image.src = supplierImage.src
    image.alt = supplierImage.alt
    image.loading = 'lazy'
    image.referrerPolicy = 'no-referrer'
    media.appendChild(image)
    value.appendChild(media)
  }
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
