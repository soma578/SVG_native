import { registerOkayamaPropertyView } from '/okayama-property-view.js'
import { showPropertyModal } from '../svg3-bosai/representative-pins/propertyModal.js'

const DATA_URL = '/api/aed-navi-data'
const SOURCE_URL = 'https://aed-navi.jp/map'
const title = 'AED N@VI 設置情報（岡山県）'
const statusEl = document.getElementById('status')
const timeEl = document.getElementById('retrievedAt')
let initialized = false
let records = []
let retrievedAt = ''
let source = 'snapshot'
let warning = ''
let svgMap
let svgImage
let layerID
let renderTimer

window.addEventListener('layerWebAppReady', () => { void initialize() })

async function initialize() {
  if (initialized) return
  initialized = true
  ;({ svgMap, svgImage, layerID } = window)
  registerOkayamaPropertyView(svgMap, showDetails, layerID)
  document.getElementById('reload').addEventListener('click', () => { void loadData() })
  window.addEventListener('zoomPanMap', scheduleRender)
  window.setInterval(scheduleRender, 60_000)
  window.setInterval(() => { void loadData() }, 120_000)
  await loadData()
}

async function loadData() {
  try {
    const response = await fetch(DATA_URL)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    if (!Array.isArray(data.records)) throw new Error('データ形式を確認できません')
    records = data.records
    retrievedAt = data.retrievedAt
    source = data.source
    warning = data.warning || ''
    timeEl.textContent = formatDate(retrievedAt)
    render()
  } catch (error) {
    console.error('[aed-navi]', error)
    statusEl.textContent = `取得に失敗しました: ${error.message}`
  }
}

function scheduleRender() {
  clearTimeout(renderTimer)
  renderTimer = setTimeout(render, 120)
}

function currentTokyoTime() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date()).reduce((out, part) => ({ ...out, [part.type]: part.value }), {})
  return { day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(parts.weekday), minute: Number(parts.hour) * 60 + Number(parts.minute) }
}

function scheduleStatus(record, clock) {
  if (record.alwaysAvail) return 'open'
  const hours = record.hours?.[clock.day]
  if (!record.avail || !/^\d{8}$/.test(hours || '') || hours === '00000000') return 'unknown'
  const start = Number(hours.slice(0, 2)) * 60 + Number(hours.slice(2, 4))
  const end = Number(hours.slice(4, 6)) * 60 + Number(hours.slice(6, 8))
  if (start >= 1440 || end > 1440 || start === end) return 'unknown'
  return clock.minute >= start && clock.minute < end ? 'open' : 'closed'
}

function render() {
  if (!svgImage || !svgMap) return
  const box = svgMap.getGeoViewBox()
  if (!box) return
  const west = Math.min(box.x, box.x + box.width), east = Math.max(box.x, box.x + box.width)
  const south = Math.min(box.y, box.y + box.height), north = Math.max(box.y, box.y + box.height)
  const fragment = svgImage.createDocumentFragment()
  const clock = currentTokyoTime()
  let visible = 0
  for (const record of records) {
    if (record.lng < west || record.lng > east || record.lat < south || record.lat > north) continue
    const state = scheduleStatus(record, clock)
    const marker = svgImage.createElement('use')
    marker.setAttribute('xlink:href', `#aed-${state}`)
    marker.setAttribute('transform', `ref(svg,${(record.lng * 100).toFixed(5)},${(-record.lat * 100).toFixed(5)})`)
    marker.setAttribute('data-record-id', String(record.id))
    marker.setAttribute('data-layer-id', 'aedNavi')
    marker.setAttribute('data-kind', 'poi')
    marker.setAttribute('data-title', title)
    marker.setAttribute('content', [record.name || `AED N@VI #${record.id}`, record.address || '-', record.id, stateLabel(state), record.lat, record.lng, formatDate(retrievedAt), 'AED N@VI', SOURCE_URL].map(csvSafe).join(','))
    marker.setAttribute('xlink:title', record.name || `AED N@VI #${record.id}`)
    marker.setAttribute('pointer-events', 'all')
    fragment.appendChild(marker)
    visible++
  }
  svgImage.getElementById('aedPoints').replaceChildren(fragment)
  const age = Date.now() - Date.parse(retrievedAt)
  const delay = Number.isFinite(age) && age > 2 * 60 * 60 * 1000 ? '。位置データの更新が2時間以上遅れています' : ''
  const freshness = source === 'live' ? '公式データ取得済み' : (warning || '保存済みデータ')
  statusEl.textContent = `岡山県内 ${records.length.toLocaleString('ja-JP')}件中、画面内 ${visible.toLocaleString('ja-JP')}件を表示。${freshness}${delay}`
  svgMap.refreshScreen()
}

async function showDetails(target) {
  const id = Number(target?.getAttribute('data-record-id'))
  const record = records.find((item) => item.id === id)
  if (!record) return
  const query = new URLSearchParams({ id: String(id), lat: String(record.lat), lng: String(record.lng) })
  let detail = null
  try {
    const response = await fetch(`/api/aed-navi-detail?${query}`, { cache: 'no-store' })
    if (response.ok) detail = (await response.json()).record
  } catch (error) { console.warn('[aed-navi] detail unavailable', error) }
  const rows = [
    ['所在地', detail?.place_address || record.address || '-'],
    ['掲載時間', stateLabel(scheduleStatus(record, currentTokyoTime()))],
    ['AED N@VI ID', id],
    ['備考', detail?.place_notes || detail?.avail_notes || '-'],
    ['データ取得日時', formatDate(retrievedAt)],
    ['出典', 'AED N@VI'],
  ].map(([name, value]) => `<div class="svg3-property-row"><dt>${escapeHtml(name)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')
  showPropertyModal(`<article class="svg3-property svg3-property-webcam-compact"><header class="svg3-property-header"><h2 class="svg3-property-title">${escapeHtml(detail?.place_name || record.name || `AED N@VI #${id}`)}</h2></header><dl class="svg3-property-body">${rows}</dl><div class="svg3-property-actions svg3-property-actions-padded"><a class="svg3-property-link" href="${SOURCE_URL}" target="_blank" rel="noopener noreferrer">公式地図を開く</a></div></article>`, { attribution: { label: 'AED N@VI', url: SOURCE_URL } })
}

function stateLabel(state) { return state === 'open' ? '通常の掲載時間内' : state === 'closed' ? '通常の掲載時間外' : '時間情報なし' }
function formatDate(value) { return value ? new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tokyo' }).format(new Date(value)) : '-' }
function csvSafe(value) { return String(value ?? '').replaceAll(',', '、').replaceAll('\n', ' ') }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])) }
