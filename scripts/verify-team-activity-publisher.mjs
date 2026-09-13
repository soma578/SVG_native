import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildCsvQtctArtifacts } from '../map/publishers/shared/csvQtctPipeline.mjs'
import { buildRuntimeCsv } from '../map/publishers/team-activity-csv/runtimeCsv.mjs'
import { parseTeamActivityCsv } from '../svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/layers/portable/team-activity/teamActivityCsv.js'

const readJson = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), 'utf8'))
const csvText = fs.readFileSync(new URL('../map/layers/managed/team-activity-pins/data.csv', import.meta.url), 'utf8')
const regions = readJson('../map/regions/index.json').regions
const config = readJson('../map/layers/managed/team-activity-pins/layer.config.json')
const districtIndexes = new Map([['okayama', readJson('../map/data/district-indexes/okayama/district-index.json')]])

const check = (source) => {
  const artifacts = buildCsvQtctArtifacts({ csvText: source, regions, config, districtIndexes })
  assert.deepEqual(artifacts.errors, [])
  const delivery = parseTeamActivityCsv(buildRuntimeCsv(artifacts.records))
  assert.deepEqual(delivery.errors, [])
  assert.equal(delivery.records.length, artifacts.records.length)
  assert(artifacts.files.has('data/qtct/teamActivity/summary.json'))
  return delivery.records
}

assert.equal(check(csvText).length, 3)
const added = `${csvText.trimEnd()}\nteam-004,追加テスト,岡山県,岡山市北区,岡山市 北区 駅元町,active,追加概要,追加説明,駅元町,運営者\n`
const records = check(added)
assert.equal(records.length, 4)
assert.equal(records[3].title, '追加テスト')
assert.equal(records[3].municipalityCode, '33101')
assert(Number.isFinite(records[3].lat) && Number.isFinite(records[3].lon))

console.log('[team-activity-publisher] original CSV -> QTCT + live CSV: 3 existing and 1 added record passed')
