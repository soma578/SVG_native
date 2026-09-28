import {
  OXYGEN_DEVICE_STORAGE_KEY,
  normalizeOxygenDeviceCsvBytes,
  normalizeOxygenDeviceCsvText,
} from './oxygenDeviceCsv.js'
import { showPropertyModal } from '../svg3-bosai/representative-pins/propertyModal.js'

const ui = {
  reload: document.getElementById('reloadButton'),
  status: document.getElementById('statusMessage'),
  visible: document.getElementById('visibleCount'),
  total: document.getElementById('totalCount'),
  latestAt: document.getElementById('latestAt'),
  filters: [...document.querySelectorAll('.eventFilter')],
  csvFile: document.getElementById('csvFile'),
  csvStatus: document.getElementById('csvStatus'),
  restore: document.getElementById('restoreButton'),
  download: document.getElementById('downloadButton'),
  writeProject: document.getElementById('writeProjectButton'),
}

const ICONS = new Map([
  ['定期送信', '#event-periodic'],
  ['主電源OFF', '#event-power-off'],
  ['運転停止', '#event-stopped'],
  ['ディーラーメンテナンス', '#event-maintenance'],
])

const EVENT_LABELS = new Map([
  ['定期送信', '定期送信'],
  ['主電源OFF', '主電源OFF'],
  ['運転停止', '運転停止'],
  ['ディーラーメンテナンス', 'メンテナンス中'],
])

let initialized = false
let records = []
let svgMap
let svgImage
let layerID
let currentCsvText = ''

window.addEventListener('layerWebAppReady', initialize)

async function initialize() {
  if (initialized) return
  initialized = true
  ;({ svgMap, svgImage, layerID } = window)
  ui.reload.addEventListener('click', loadData)
  ui.filters.forEach((filter) => filter.addEventListener('change', draw))
  ui.csvFile.addEventListener('change', importCsv)
  ui.restore.addEventListener('click', restorePublishedCsv)
  ui.download.addEventListener('click', downloadCurrentCsv)
  ui.writeProject.addEventListener('click', writeProjectCsv)
  ui.writeProject.disabled = !('showDirectoryPicker' in window)
  if (ui.writeProject.disabled) ui.writeProject.title = 'このブラウザはプロジェクトへの直接書き出しに対応していません'
  configureDetails()
  await loadData()
}

function configureDetails() {
  svgMap.setShowPoiProperty((target) => {
    const record = records[Number(target?.getAttribute('data-record-index'))]
    if (!record) return
    const fields = [
      ['装置ID', record['装置ID']], ['機種番号', record['機種番号']], ['装置シリアルNo', record['装置シリアルNo']],
      ['日時', record['日時']], ['イベント内容', record['イベント内容']], ['装置状態', record['装置状態']],
      ['設定流量', unit(record['設定流量(L/min)'], 'L/min')], ['実流量', unit(record['実流量(L/min)'], 'L/min')],
      ['酸素濃度', unit(record['酸素濃度(%)'], '%')], ['内部積算時間', unit(record['内部積算時間(時)'], '時間')],
      ['外部積算時間', unit(record['外部積算時間(時)'], '時間')], ['バッテリー電圧', unit(record['バッテリー電圧(V)'], 'V')],
      ['RSRP / RSRQ', `${record.RSRP || '-'} / ${record.RSRQ || '-'}`],
      ['酸素出口圧力', unit(record['酸素出口圧力(kPaG)'], 'kPaG')], ['PSA圧力', unit(record['PSA圧力(kPaG)'], 'kPaG')],
      ['コンプレッサー回転数', unit(record['コンプレッサー回転数(rpm)'], 'rpm')],
      ['MAIN温度', unit(record['温度(MAINユニット)(℃)'], '℃')], ['超音波センサ温度', unit(record['温度(超音波センサ)(℃)'], '℃')],
      ['基地局キャリア', record['IoT基地局キャリア']], ['周波数帯', record['周波数帯']],
    ]
    const rows = fields.filter(([, value]) => value !== '' && value != null)
      .map(([name, value]) => `<div class="svg3-property-row"><dt>${escapeHtml(name)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')
    showPropertyModal(`
      <article class="svg3-property svg3-property-evacuation svg3-property-webcam-compact">
        <header class="svg3-property-header">
          <p class="svg3-property-kind">酸素濃縮装置</p>
          <h2 class="svg3-property-title">${escapeHtml(record['装置ID'])}</h2>
          <div class="svg3-property-status"><span class="svg3-property-dot"></span><span>${escapeHtml(EVENT_LABELS.get(record['イベント内容']) || record['イベント内容'] || '状態不明')}</span></div>
        </header>
        <dl class="svg3-property-body">${rows}</dl>
      </article>
    `, { attribution: { label: 'logpot提供CSV' } })
  }, layerID)
}

async function loadData() {
  ui.reload.disabled = true
  setStatus('ログを読み込んでいます', '')
  try {
    const response = await fetch('./latest.csv', { cache: 'no-store' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const published = normalizeOxygenDeviceCsvText(await response.text())
    if (published.errors.length) throw new Error(published.errors[0])
    const saved = readSavedCsv()
    if (saved) {
      const local = normalizeOxygenDeviceCsvText(saved)
      if (local.errors.length) {
        saveCsv('')
        applyDataset(published, '保存データが不正なため、配信中のCSVへ戻しました', true)
      } else applyDataset(local, `このブラウザで選択したCSVを表示中（${local.records.length}件）`, false)
    } else applyDataset(published, `配信中のCSVを表示中（${published.records.length}件）`, false)
  } catch (error) {
    console.error(error)
    records = []
    draw()
    setStatus(`読み込みに失敗しました（${error.message}）`, 'error')
  } finally {
    ui.reload.disabled = false
  }
}

function applyDataset(result, message, warning) {
  records = result.records
  currentCsvText = result.csvText
  ui.total.textContent = records.length.toLocaleString('ja-JP')
  ui.latestAt.textContent = records.reduce((latest, record) =>
    parseLogDate(record['日時']) > parseLogDate(latest) ? record['日時'] : latest, '') || '-'
  ui.download.disabled = !currentCsvText
  ui.csvStatus.dataset.error = warning ? 'true' : 'false'
  ui.csvStatus.textContent = message
  draw()
}

async function importCsv(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  try {
    const result = normalizeOxygenDeviceCsvBytes(await file.arrayBuffer())
    if (result.errors.length) throw new Error(result.errors.slice(0, 8).join('\n'))
    saveCsv(result.csvText)
    applyDataset(result, `${file.name} を反映しました（${result.records.length}件・このブラウザに保存済み）`, false)
  } catch (error) {
    ui.csvStatus.dataset.error = 'true'
    ui.csvStatus.textContent = `CSVを反映できません: ${error.message}`
  }
}

function restorePublishedCsv() {
  saveCsv('')
  void loadData()
}

function readSavedCsv() {
  try { return localStorage.getItem(OXYGEN_DEVICE_STORAGE_KEY) || '' }
  catch { return '' }
}

function saveCsv(value) {
  try {
    if (value) localStorage.setItem(OXYGEN_DEVICE_STORAGE_KEY, value)
    else localStorage.removeItem(OXYGEN_DEVICE_STORAGE_KEY)
  } catch { /* The current session still displays the imported CSV. */ }
}

function downloadCurrentCsv() {
  if (!currentCsvText) return
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([currentCsvText], { type: 'text/csv;charset=utf-8' }))
  link.download = 'oxygen-device-latest.csv'
  link.click()
  setTimeout(() => URL.revokeObjectURL(link.href), 0)
}

async function writeProjectCsv() {
  if (!currentCsvText || !('showDirectoryPicker' in window)) return
  try {
    const projectRoot = await window.showDirectoryPicker({ mode: 'readwrite' })
    await projectRoot.getFileHandle('package.json')
    await writeProjectFile(projectRoot, 'svgmapAppLayers/appLayers/oxygenDeviceLog/latest.csv', currentCsvText)
    try {
      await writeProjectFile(projectRoot, 'public/svgmapAppLayers/appLayers/oxygenDeviceLog/latest.csv', currentCsvText)
    } catch { /* public/ may not exist before the first asset build. */ }
    ui.csvStatus.dataset.error = 'false'
    ui.csvStatus.textContent = `${records.length}件をプロジェクトへ書き出しました。公開にはコミットと再デプロイが必要です。`
  } catch (error) {
    if (error?.name === 'AbortError') return
    ui.csvStatus.dataset.error = 'true'
    ui.csvStatus.textContent = `書き出しに失敗しました: ${error.message}`
  }
}

async function writeProjectFile(root, relativePath, content) {
  const parts = relativePath.split('/')
  const filename = parts.pop()
  let directory = root
  for (const part of parts) directory = await directory.getDirectoryHandle(part, { create: true })
  const handle = await directory.getFileHandle(filename, { create: true })
  const writable = await handle.createWritable()
  await writable.write(content)
  await writable.close()
}

function draw() {
  if (!svgImage) return
  const enabled = new Set(ui.filters.filter((filter) => filter.checked).map((filter) => filter.value))
  const fragment = svgImage.createDocumentFragment()
  let visible = 0
  records.forEach((record, index) => {
    if (!enabled.has(record['イベント内容'])) return
    const lat = Number(record['緯度'])
    const lng = Number(record['経度'])
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
    const marker = svgImage.createElement('use')
    marker.setAttribute('xlink:href', ICONS.get(record['イベント内容']) || '#event-other')
    marker.setAttribute('transform', `ref(svg,${(lng * 100).toFixed(5)},${(-lat * 100).toFixed(5)})`)
    marker.setAttribute('data-record-index', String(index))
    marker.setAttribute('data-feature-id', record['装置ID'])
    marker.setAttribute('data-layer-id', 'oxygenDeviceLog')
    marker.setAttribute('data-kind', 'poi')
    marker.setAttribute('data-title', record['装置ID'])
    marker.setAttribute('data-feature', JSON.stringify(record))
    marker.setAttribute('content', [record['装置ID'], record['機種番号'], record['日時'], record['イベント内容'], record['設定流量(L/min)'], record['実流量(L/min)'], record['酸素濃度(%)'], record['装置状態'], record.RSRP, record['バッテリー電圧(V)']].map(csvSafe).join(','))
    marker.setAttribute('xlink:title', record['装置ID'])
    marker.setAttribute('pointer-events', 'all')
    fragment.appendChild(marker)
    visible += 1
  })
  svgImage.getElementById('devicePoints').replaceChildren(fragment)
  ui.visible.textContent = visible.toLocaleString('ja-JP')
  setStatus(`${visible}件を表示しています`, '')
  svgMap.refreshScreen()
}

const unit = (value, suffix) => value === '' || value == null ? '' : `${value} ${suffix}`
const csvSafe = (value) => String(value ?? '').replaceAll(',', '、')
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))
const parseLogDate = (value) => {
  const match = String(value || '').match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})$/)
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5])).getTime() : 0
}
function setStatus(message, type) {
  ui.status.textContent = message
  ui.status.className = `status${type ? ` ${type}` : ''}`
}
