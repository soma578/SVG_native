#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = path.join(root, 'svgmapAppLayers/appLayers/okayamaLandslideCandidates/candidates.json')
const origin = 'https://www.gis.pref.okayama.jp'
const positionUrl = `${origin}/pref-okayama/PositionSelect?mid=5002`
const searchUrl = `${origin}/pref-okayama/FreewordSearch/FreewordSearch`
const sources = [
  { type: '急傾斜', mcl: '46,130,1,790', expectedCount: 16794 },
  { type: '土石流', mcl: '46,140,1,790', expectedCount: 2868 },
]

const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage()
  await page.goto(positionUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  if (await page.locator('#Agree').count()) {
    await page.locator('#Agree').click()
    await page.waitForURL(/PositionSelect/, { timeout: 30_000 })
    await page.waitForTimeout(3_000)
  }

  const records = []
  for (const source of sources) {
    await page.goto(`${origin}/pref-okayama/ThemeSearch?mid=5002&mcl=${encodeURIComponent(source.mcl)}`, {
      waitUntil: 'domcontentloaded', timeout: 60_000,
    })
    await page.waitForFunction(() => window.$?.('#theme-grid').data('executedParam')?.list?.length, null, { timeout: 60_000 })
    const initial = await page.evaluate(() => window.$('#theme-grid').data('executedParam'))
    const layerId = String(initial.list[0]?.fid || '').split('-').at(-1)
    if (!/^\d+$/.test(layerId)) throw new Error(`Could not resolve layer ID for ${source.type}`)
    if (initial.recordCount !== source.expectedCount) {
      throw new Error(`${source.type}: expected ${source.expectedCount}, received ${initial.recordCount}`)
    }
    const pageCount = Math.ceil(initial.recordCount / 50)
    for (let pageNo = 1; pageNo <= pageCount; pageNo += 1) {
      const response = await page.request.post(searchUrl, { form: {
        sortConditon: '', pno: String(pageNo), mid: '5002', mtl: layerId, omtl: layerId,
        skw: '', skwt: '1', tsf: '1', mcl: source.mcl, pgid: '', tbdb: '1', pct: '50', ac: '',
      }, timeout: 60_000 })
      if (!response.ok()) throw new Error(`${source.type} page ${pageNo}: HTTP ${response.status()}`)
      const payload = await response.json()
      const pageRecords = payload?.JsonResult?.tbdb?.records
      if (!Array.isArray(pageRecords)) throw new Error(`${source.type} page ${pageNo}: invalid response`)
      records.push(...pageRecords.map((record) => ({
        id: `${source.type}-${record.txt}`,
        featureId: record.fid,
        siteNumber: record.txt,
        type: source.type,
        location: record.attribute?.FIELD021 || '',
        householdClass: record.attribute?.FIELD022 || '',
        lon: Number(record.center_x || record.x),
        lat: Number(record.center_y || record.y),
      })))
      if (pageNo % 25 === 0 || pageNo === pageCount) {
        console.log(`[okayama-landslide] ${source.type}: ${Math.min(pageNo * 50, initial.recordCount)}/${initial.recordCount}`)
      }
    }
  }

  const validRecords = records.filter((record) => Number.isFinite(record.lat) && Number.isFinite(record.lon))
  const data = {
    schemaVersion: 1,
    title: '新たな「土砂災害が発生するおそれのある箇所」',
    sourceUpdatedAt: '2026-05-20',
    importedAt: new Date().toISOString(),
    source: 'https://www.pref.okayama.jp/page/1036031.html',
    gis: positionUrl,
    counts: {
      steepSlope: validRecords.filter((record) => record.type === '急傾斜').length,
      debrisFlow: validRecords.filter((record) => record.type === '土石流').length,
      total: validRecords.length,
    },
    records: validRecords,
  }
  if (data.counts.total !== 19662) throw new Error(`Expected 19662 records, received ${data.counts.total}`)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, `${JSON.stringify(data)}\n`, 'utf8')
  console.log(`[okayama-landslide] wrote ${data.counts.total} records to ${path.relative(root, outputPath)}`)
} finally {
  await browser.close()
}
