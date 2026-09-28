#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeOxygenDeviceCsvBytes } from '../svgmapAppLayers/appLayers/oxygenDeviceLog/oxygenDeviceCsv.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = path.resolve(process.env.OXYGEN_LOG_SOURCE
  || path.join(root, '最新ログ(2026年09月15日19時37分).csv'))
const destination = path.join(root, 'svgmapAppLayers/appLayers/oxygenDeviceLog/latest.csv')

if (process.argv.includes('--check')) {
  assert(fs.existsSync(destination), `生成済みCSVが見つかりません: ${destination}`)
  const publishedText = fs.readFileSync(destination, 'utf8')
  const published = normalizeOxygenDeviceCsvBytes(Buffer.from(publishedText))
  assert.equal(published.errors.length, 0, published.errors.slice(0, 10).join('\n'))
  assert.equal(published.csvText, publishedText, 'latest.csvは正規化されたUTF-8 CSVではありません')
  assert(!/IMSI|データ先コード|装置ユーザ/.test(publishedText), '公開CSVに非公開識別子が含まれています')
  if (fs.existsSync(source)) {
    const imported = normalizeOxygenDeviceCsvBytes(fs.readFileSync(source))
    assert.equal(imported.errors.length, 0, imported.errors.slice(0, 10).join('\n'))
    assert.equal(publishedText, imported.csvText,
      'latest.csvが取込元と一致しません。npm run data:oxygen-log を実行してください')
  }
  console.log(`[oxygen-device-log] ${published.records.length} records passed; private identifiers excluded`)
} else {
  assert(fs.existsSync(source), `取込元CSVが見つかりません: ${source}`)
  const imported = normalizeOxygenDeviceCsvBytes(fs.readFileSync(source))
  assert.equal(imported.errors.length, 0, imported.errors.slice(0, 10).join('\n'))
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  fs.writeFileSync(destination, imported.csvText)
  console.log(`[oxygen-device-log] ${imported.records.length} records -> ${path.relative(root, destination)}`)
}
