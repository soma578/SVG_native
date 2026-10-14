import { showPropertyModal } from '../svg3-bosai/representative-pins/propertyModal.js'
import { displayState, parseAssets } from './model.js'

const kind = document.body.dataset.kind
const dataFile = kind === 'battery' ? 'battery.json' : 'movingHouse.json'
const layerName = kind === 'battery' ? '非常用電源' : 'ムービングハウス'
const ui = {
  reload: document.getElementById('reloadButton'),
  status: document.getElementById('statusMessage'),
  visible: document.getElementById('visibleCount'),
  total: document.getElementById('totalCount'),
  updatedAt: document.getElementById('updatedAt'),
  demo: document.getElementById('demoNotice'),
}
let initialized = false
let isDemo = false
let records = []
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
  svgMap.setShowPoiProperty(showAssetProperty, layerID)
  await loadData()
}

async function loadData() {
  ui.reload.disabled = true
  setStatus('データを取得しています', '')
  try {
    const response = await fetch(`./${dataFile}`, { cache: 'no-store' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const parsed = parseAssets(await response.json(), kind)
    records = parsed.assets
    isDemo = parsed.demo
    ui.demo.hidden = !isDemo
    draw()
    ui.updatedAt.textContent = formatDate(parsed.updatedAt)
    setStatus(records.length ? `${records.length}件の${isDemo ? '架空のデモ' : '登録'}データを表示しています` : '設備はまだ登録されていません', '')
  } catch (error) {
    console.error(`[${kind}] data load failed`, error)
    setStatus(`データを取得できませんでした（${error.message}）`, 'error')
  } finally {
    ui.reload.disabled = false
  }
}

function draw() {
  const fragment = svgImage.createDocumentFragment()
  records.forEach((record, index) => {
    const [state] = displayState(record, kind)
    const marker = svgImage.createElement('use')
    marker.setAttribute('xlink:href', `#asset-${state}`)
    marker.setAttribute('transform', `ref(svg,${(record.lng * 100).toFixed(5)},${(-record.lat * 100).toFixed(5)})`)
    marker.setAttribute('data-record-index', String(index))
    marker.setAttribute('data-feature-id', record.id)
    marker.setAttribute('data-layer-id', kind)
    marker.setAttribute('data-kind', 'poi')
    marker.setAttribute('data-title', record.name)
    marker.setAttribute('content', [record.id, record.name, displayState(record, kind)[1], record.updatedAt]
      .map(csvSafe).join(','))
    marker.setAttribute('xlink:title', record.name)
    marker.setAttribute('pointer-events', 'all')
    fragment.appendChild(marker)
  })
  svgImage.getElementById('assetPoints').replaceChildren(fragment)
  ui.visible.textContent = records.length.toLocaleString('ja-JP')
  ui.total.textContent = records.length.toLocaleString('ja-JP')
  svgMap.refreshScreen()
}

export function showAssetProperty(target) {
  const record = records[Number(target?.getAttribute('data-record-index'))]
  if (!record) return
  const [state, status] = displayState(record, kind)
  const rows = kind === 'battery' ? [
    ['設備ID', record.id], ['設置場所', record.address || '未登録'],
    ['残量', record.chargePercent === null ? '未確認' : `${record.chargePercent}%`],
    ['定格容量', record.capacityKWh === null ? '未登録' : `${record.capacityKWh} kWh`],
    ['残り電力量（概算）', record.chargePercent === null || record.capacityKWh === null
      ? '算出不可' : `約${Math.round(record.chargePercent * record.capacityKWh) / 100} kWh`],
    ['最終確認', formatDate(record.updatedAt)],
  ] : [
    ['住宅ID', record.id], ['設置場所', record.address || '未登録'],
    ['設置状況', placementLabel(record.placement)],
    ['入居受付', record.accepting === null ? '未確認' : record.accepting ? '受付中' : '受付停止'],
    ['定員', record.capacity === null ? '未登録' : `${record.capacity}人`],
    ['入居人数', record.occupied === null ? '未登録' : `${record.occupied}人`],
    ['空き人数', record.capacity === null || record.occupied === null
      ? '算出不可' : `${record.capacity - record.occupied}人`],
    ['最終確認', formatDate(record.updatedAt)],
  ]
  const colors = { available: '#15803d', partial: '#a16207', unavailable: '#b91c1c', unknown: '#475569' }
  if (isDemo) rows.unshift(['データ種別', 'デモ・架空データ（実在設備ではありません）'])
  const body = rows.map(([label, value]) => `<div class="svg3-property-row"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')
  return showPropertyModal(`<article class="svg3-property svg3-property-webcam-compact" style="--property-accent:${colors[state]}">
    <header class="svg3-property-header"><p class="svg3-property-kind">${layerName}</p>
    <h2 class="svg3-property-title">${escapeHtml(record.name)}</h2>
    <div class="svg3-property-status"><span class="svg3-property-dot"></span><span>${escapeHtml(status)}</span></div></header>
    <dl class="svg3-property-body">${body}</dl></article>`,
  { attribution: { label: isDemo ? '架空のデモデータ' : '岡山大学・手動登録データ' } })
}

function placementLabel(value) {
  return { inTransit: '輸送中', installing: '設置中', installed: '設置済み', unknown: '不明' }[value]
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
