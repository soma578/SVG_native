import assert from 'node:assert/strict'
import {
  assertAllowedOutagePath,
  parseHistoryPage,
  parseMunicipalityDetail,
  parsePrefecturePage,
} from '../app/api/chugoku-outages/normalize.js'

const prefecture = parsePrefecturePage(`
  <p>最終更新日時：2026年09月30日 15:05</p>
  <span data-href="https://www.teideninfo.energia.co.jp/LWC31050/index/33101"></span>
  <span data-href="https://www.teideninfo.energia.co.jp/LWC31050/index/33101"></span>
`)
assert.equal(prefecture.updatedAt, '2026-09-30T15:05:00+09:00')
assert.deepEqual(prefecture.municipalityPaths, [{
  path: '/LWC31050/index/33101', municipalityCode: '33101', prefectureCode: '33', prefectureName: '岡山県',
}])

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

const history = parseHistoryPage(`
  <p>最終更新日時：2026年10月01日 14:09</p>
  <ul class="js-knm p-table-list" data-egs-tdn="3110J07427">
    <li><div class="C FC_red p-table-listCell03">2026/09/30 11:59</div>
    <div class="C FC_blue p-table-listCell03">2026/09/30 16:22</div>
    <div class="u-fx1">当社設備への倒木</div><div class="R p-table-listCell03">約 20 戸</div></li>
    <li class="js-tdk" data-tdk="島根県"><div>島根県</div></li>
    <li class="js-scg" data-scg="大田市" data-egs-tdn="3110J07427">
      <span class="js-jsy" data-jsy="三瓶町　池田">三瓶町　池田</span></li>
  </ul><script src="history.js"></script>
`, 'standard')
assert.equal(history.updatedAt, '2026-10-01T14:09:00+09:00')
assert.equal(history.outages.length, 1)
assert.deepEqual(history.outages[0], {
  id: '3110J07427-32-大田市', eventId: '3110J07427', state: 'restored', outageType: 'standard',
  prefectureCode: '32', prefectureName: '島根県', municipalityCode: null, municipalityName: '大田市',
  startedAt: '2026-09-30T11:59:00+09:00', restoredAt: '2026-09-30T16:22:00+09:00',
  status: '復旧済み', expectedRestore: '', reason: '当社設備への倒木', households: 20,
  areas: [{ name: '三瓶町　池田', households: null }],
})

assert.equal(assertAllowedOutagePath('/'), '/')
assert.equal(assertAllowedOutagePath('/LWC31050/index/31201'), '/LWC31050/index/31201')
assert.equal(assertAllowedOutagePath('/LWC30040/index?date=20260930&type=s'), '/LWC30040/index?date=20260930&type=s')
assert.throws(() => assertAllowedOutagePath('/LWC30040/index?date=invalid'))
assert.throws(() => assertAllowedOutagePath('/LWC31133.html'))
assert.throws(() => assertAllowedOutagePath('https://example.com/'))

console.log('[chugoku-outages] fixed-source parser and SSRF boundary passed')
