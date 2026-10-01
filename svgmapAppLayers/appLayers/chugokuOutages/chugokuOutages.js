import { showPropertyModal } from '../svg3-bosai/representative-pins/propertyModal.js'

const API_URL = '/api/chugoku-outages'
const DISTRICT_INDEX_URL = '/map/data/district-indexes/okayama/district-index.json'
const SOURCE_URL = 'https://www.teideninfo.energia.co.jp/LWC31133.html'
const ui = {
  reload: document.getElementById('reloadButton'), status: document.getElementById('statusMessage'),
  count: document.getElementById('outageCount'), households: document.getElementById('householdCount'),
  sourceUpdatedAt: document.getElementById('sourceUpdatedAt'), fetchedAt: document.getElementById('fetchedAt'),
}
let initialized = false
let records = []
let districts = []
let svgMap
let svgImage
let layerID

window.addEventListener('layerWebAppReady', initialize)
async function initialize() {
  if (initialized) return
  initialized = true
  ;({ svgMap, svgImage, layerID } = window)
  ui.reload.addEventListener('click', loadData)
  configureDetails()
  await loadData()
}

function configureDetails() {
  svgMap.setShowPoiProperty((target) => {
    const record = records[Number(target?.getAttribute('data-record-index'))]
    if (!record) return
    const areaRows = record.areas.map((area) => `${area.name}${area.households ? `（約${area.households.toLocaleString('ja-JP')}戸）` : ''}`).join('\n')
    const rows = [['発生日時', formatDate(record.startedAt)], ['地域', areaRows],
      ['停電戸数', record.households ? `約${record.households.toLocaleString('ja-JP')}戸` : '確認中'],
      ['対応状況', record.status || '確認中'], ['復旧見込み', record.expectedRestore || '確認中'],
      ['停電理由', record.reason || '確認中'], ['表示位置', record.positionLabel]]
      .map(([name, value]) => `<div class="svg3-property-row"><dt>${escapeHtml(name)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')
    showPropertyModal(`<article class="svg3-property svg3-property-warning svg3-property-webcam-compact">
      <header class="svg3-property-header"><p class="svg3-property-kind">中国電力ネットワーク 停電情報</p>
      <h2 class="svg3-property-title">${escapeHtml(record.title)}</h2>
      <div class="svg3-property-status"><span class="svg3-property-dot"></span><span>停電発生中</span></div></header>
      <dl class="svg3-property-body">${rows}</dl><div class="svg3-property-actions svg3-property-actions-padded">
      <a class="svg3-property-link" href="${SOURCE_URL}" target="_blank" rel="noopener noreferrer">公式情報を確認</a></div></article>`,
    { attribution: { label: '中国電力ネットワーク', url: SOURCE_URL } })
  }, layerID)
}

async function loadData() {
  ui.reload.disabled = true
  setStatus('最新の停電情報を取得しています', '')
  try {
    const [outageResponse, districtResponse] = await Promise.all([fetch(API_URL, { cache: 'no-store' }), fetch(DISTRICT_INDEX_URL)])
    const outageData = await outageResponse.json()
    if (!outageResponse.ok) throw new Error(outageData.error || `HTTP ${outageResponse.status}`)
    if (!districtResponse.ok) throw new Error(`地区位置データ HTTP ${districtResponse.status}`)
    districts = (await districtResponse.json()).districts || []
    records = outageData.outages.map(enrichPosition).filter((record) => record.lat != null && record.lon != null)
    draw()
    ui.sourceUpdatedAt.textContent = formatDate(outageData.sourceUpdatedAt)
    ui.fetchedAt.textContent = formatDate(outageData.fetchedAt)
    const stale = Boolean(outageData.stale)
    setStatus(stale ? `${records.length}件を表示中。${outageData.warning}`
      : records.length ? `${records.length}件の停電情報を表示しています` : '岡山県内で現在発生中の停電はありません', stale ? 'error' : '')
  } catch (error) {
    console.error(error)
    records = []
    draw()
    setStatus(`取得できませんでした（${error.message}）。公式情報を確認してください。`, 'error')
  } finally { ui.reload.disabled = false }
}

function enrichPosition(record) {
  const municipality = districts.filter((district) => district.municipalityCode === record.municipalityCode)
  const areaNames = record.areas.map((area) => normalizePlace(area.name)).filter(Boolean)
  const areaMatches = areaNames.length ? municipality.filter((district) => areaNames.some((area) => normalizePlace(district.name).includes(area))) : []
  const candidates = areaMatches.length ? areaMatches : municipality
  if (!candidates.length) return { ...record, lat: null, lon: null, positionLabel: '位置情報なし' }
  const lon = candidates.reduce((sum, item) => sum + Number(item.lon), 0) / candidates.length
  const lat = candidates.reduce((sum, item) => sum + Number(item.lat), 0) / candidates.length
  const municipalityName = candidates[0].municipalityName || record.municipalityCode
  return { ...record, lat, lon, title: `${municipalityName}${record.areas[0]?.name ? ` ${record.areas[0].name}` : ''}`,
    positionLabel: areaMatches.length ? '公表地域の代表点（概略）' : `${municipalityName}の代表点（概略）` }
}

function draw() {
  const fragment = svgImage.createDocumentFragment()
  records.forEach((record, index) => {
    const marker = svgImage.createElement('use')
    marker.setAttribute('xlink:href', '#outage-marker')
    marker.setAttribute('transform', `ref(svg,${(record.lon * 100).toFixed(5)},${(-record.lat * 100).toFixed(5)})`)
    marker.setAttribute('data-record-index', String(index)); marker.setAttribute('data-feature-id', record.id)
    marker.setAttribute('data-layer-id', 'chugokuOutages'); marker.setAttribute('data-kind', 'poi')
    marker.setAttribute('data-title', record.title); marker.setAttribute('data-feature', JSON.stringify(record))
    marker.setAttribute('content', [record.municipalityCode, record.startedAt, record.areas.map((area) => area.name).join('・'), record.households, record.status, record.expectedRestore, record.reason].map(csvSafe).join(','))
    marker.setAttribute('xlink:title', record.title); marker.setAttribute('pointer-events', 'all'); fragment.appendChild(marker)
  })
  svgImage.getElementById('outagePoints').replaceChildren(fragment)
  ui.count.textContent = records.length.toLocaleString('ja-JP')
  const total = records.reduce((sum, record) => sum + (record.households || 0), 0)
  ui.households.textContent = total.toLocaleString('ja-JP')
  svgMap.refreshScreen()
}

const normalizePlace = (value) => String(value || '').normalize('NFKC').replace(/[\s　]/g, '')
  .replace(/一丁目/g, '1丁目').replace(/二丁目/g, '2丁目').replace(/三丁目/g, '3丁目').replace(/四丁目/g, '4丁目')
  .replace(/五丁目/g, '5丁目').replace(/六丁目/g, '6丁目').replace(/七丁目/g, '7丁目').replace(/八丁目/g, '8丁目').replace(/九丁目/g, '9丁目')
const csvSafe = (value) => String(value ?? '').replaceAll(',', '、').replaceAll('\n', ' ')
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))
const formatDate = (value) => value ? new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tokyo' }).format(new Date(value)) : '-'
function setStatus(message, type) { ui.status.textContent = message; ui.status.className = `status${type ? ` ${type}` : ''}` }
