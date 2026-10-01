import assert from 'node:assert/strict'
import {
  assertAllowedOutagePath,
  parseMunicipalityDetail,
  parsePrefecturePage,
} from '../app/api/chugoku-outages/normalize.js'

const prefecture = parsePrefecturePage(`
  <p>最終更新日時：2026年09月30日 15:05</p>
  <span data-href="https://www.teideninfo.energia.co.jp/LWC31050/index/33101"></span>
  <span data-href="https://www.teideninfo.energia.co.jp/LWC31050/index/33101"></span>
`)
assert.equal(prefecture.updatedAt, '2026-09-30T15:05:00+09:00')
assert.deepEqual(prefecture.municipalityPaths, [{ path: '/LWC31050/index/33101', municipalityCode: '33101' }])

const details = parseMunicipalityDetail(`
  <div class="LayoutBox_Gray LayoutBox_BoderGray">
    <p><span>2026/09/30 11:59</span>頃より，以下の地域で停電が発生しております。<br>
    現在，<span>故障箇所の修理作業中です。<br>復旧は，本日（午後）の見込みです。<br>
    停電理由：当社設備への倒木</span></p>
    <table><tbody><tr><td>伊福町１丁目</td><td>約 20 戸</td></tr></tbody></table>
  </div>
`, '33101')
assert.equal(details.length, 1)
assert.equal(details[0].startedAt, '2026-09-30T11:59:00+09:00')
assert.equal(details[0].reason, '当社設備への倒木')
assert.equal(details[0].expectedRestore, '本日（午後）')
assert.deepEqual(details[0].areas, [{ name: '伊福町１丁目', households: 20 }])
assert.equal(details[0].households, 20)

assert.equal(assertAllowedOutagePath('/LWC31133.html'), '/LWC31133.html')
assert.throws(() => assertAllowedOutagePath('/LWC31132.html'))
assert.throws(() => assertAllowedOutagePath('https://example.com/'))

console.log('[chugoku-outages] fixed-source parser and SSRF boundary passed')
