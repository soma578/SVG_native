import { showPropertyModal } from '../svg3-bosai/representative-pins/propertyModal.js'
import { registerOkayamaPropertyView } from '/okayama-property-view.js'

const API_URL = '/api/mizupigui'
const REFRESH_MS = 60_000
const ui = {
  reload: document.getElementById('reloadButton'),
  status: document.getElementById('statusMessage'),
  visible: document.getElementById('visibleCount'),
  total: document.getElementById('totalCount'),
  updatedAt: document.getElementById('updatedAt'),
}
const markerIds = ['#stake-dry', '#stake-level-1', '#stake-level-2']
let initialized = false
let records = []
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
  registerOkayamaPropertyView(svgMap, showStakeProperty, layerID)
  await loadData()
  window.setInterval(() => {
    if (!document.hidden) void loadData()
  }, REFRESH_MS)
}

async function loadData() {
  ui.reload.disabled = true
  setStatus('最新情報を取得しています', '')
  try {
    const response = await fetch(API_URL, { cache: 'no-store' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    if (!Array.isArray(data.stakes)) throw new Error('応答形式が不正です')
    records = data.stakes
    draw()
    ui.updatedAt.textContent = formatDate(data.updatedAt)
    setStatus(records.length ? `${records.length}杭の最新状態を取得しました` : '受信済みの杭はまだありません', '')
  } catch (error) {
    console.error('[mizupigui] latest load failed', error)
    // A temporary API failure must not erase the last successfully shown map.
    setStatus(`最新情報を取得できませんでした（${error.message}）`, 'error')
  } finally {
    ui.reload.disabled = false
  }
}

function draw() {
  const fragment = svgImage.createDocumentFragment()
  let visible = 0
  records.forEach((record, index) => {
    if (typeof record.lat !== 'number' || typeof record.lng !== 'number'
      || !Number.isFinite(record.lat) || !Number.isFinite(record.lng)) return
    const marker = svgImage.createElement('use')
    marker.setAttribute('xlink:href', markerIds[record.waterLevel] || '#stake-unknown')
    marker.setAttribute('transform', `ref(svg,${(record.lng * 100).toFixed(5)},${(-record.lat * 100).toFixed(5)})`)
    marker.setAttribute('data-record-index', String(index))
    marker.setAttribute('data-feature-id', record.id)
    marker.setAttribute('data-layer-id', 'mizupigui')
    marker.setAttribute('data-kind', 'poi')
    marker.setAttribute('data-title', '水ピィ杭 最新状態（logpot）')
    marker.setAttribute('content', [record.id, record.name, waterLevelLabel(record.waterLevel),
      tiltLabel(record.tiltDetected), batteryLabel(record.batteryOk), record.lastReceivedAt,
      record.floodedAt || '', 'logpot提供データ'].map(csvSafe).join(','))
    marker.setAttribute('xlink:title', record.name)
    marker.setAttribute('pointer-events', 'all')
    fragment.appendChild(marker)
    visible += 1
  })
  svgImage.getElementById('stakePoints').replaceChildren(fragment)
  ui.visible.textContent = visible.toLocaleString('ja-JP')
  ui.total.textContent = records.length.toLocaleString('ja-JP')
  svgMap.refreshScreen()
}

function showStakeProperty(target) {
  const record = records[Number(target?.getAttribute('data-record-index'))]
  if (!record) return
  const rows = [
    ['杭ID', record.id], ['水位', waterLevelLabel(record.waterLevel)],
    ['傾斜', tiltLabel(record.tiltDetected)], ['電池', batteryLabel(record.batteryOk)],
    ['最終受信', formatDate(record.lastReceivedAt)],
    ...(record.floodedAt ? [['浸水開始', formatDate(record.floodedAt)]] : []),
  ].map(([label, value]) => `<div class="svg3-property-row"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')
  showPropertyModal(`<article class="svg3-property svg3-property-evacuation svg3-property-webcam-compact">
    <header class="svg3-property-header"><p class="svg3-property-kind">水ピィ杭</p>
    <h2 class="svg3-property-title">${escapeHtml(record.name)}</h2>
    <div class="svg3-property-status"><span class="svg3-property-dot"></span><span>${escapeHtml(waterLevelLabel(record.waterLevel))}</span></div></header>
    <dl class="svg3-property-body">${rows}</dl></article>`,
  { attribution: { label: 'logpot提供データ' } })
}

function waterLevelLabel(value) {
  return value === 0 ? '水なし' : value === 1 ? '1段目' : value === 2 ? '2段目' : 'センサー異常等'
}
function tiltLabel(value) { return value ? '検知あり' : '検知なし' }
function batteryLabel(value) { return value ? '正常' : '電池切れ' }
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
