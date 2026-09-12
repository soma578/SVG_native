# SVGMap 外部CSV＋写真POIレイヤー（共有用）

これはこのSVG3で動いているCSV写真レイヤーのコピーです。CSVの取得、緯度経度からのPOI生成、ピンの描画は本家の `csvXhr_r20.svg` / `CsvMapper.js` を使用します。追加コード `externalCsvPhotoPopup.js` は、POIクリック時の写真・説明表示だけを担当します。地図上のピン自体は本家の標準アイコンで、写真サムネイル型のピンではありません。

## 中身

| パス | 内容 |
| --- | --- |
| `svgmapAppLayers/authoringLayers/local/csvLayer/` | 本家CSVレイヤー一式と写真popup拡張。元のシンボリックリンクは実ファイルとしてコピー済み |
| `nextjs/app/api/drive-image/route.js` | Google Drive共有写真を画像として返すNext.js用API |
| `Container-animation.xml` | `Container.svg` へ追加するレイヤー定義 |
| `sample.csv` | CSV形式の例（写真URLとFile IDはダミー） |
| `svgmapAppLayers/LICENSE` | コピーした本家ファイルのライセンス |

## SVGMapへの設置

1. コピー先に互換性のある `svgmapjs` / `svgmapAppLayers` があることを確認します。このフォルダだけでSVGMap本体が動くわけではありません。
2. `svgmapAppLayers/authoringLayers/local/csvLayer/` の中身を、コピー先の同名フォルダへ配置します。既存の本家CSVレイヤーを利用中なら、まず差分を確認してください。写真拡張の主な差分は `externalCsvPhotoPopup.js` の追加と `csvUI_r20.html` の4行のimportです。本家のCSV解析・QTCTコードを新方式へ置き換えません。
3. `Container-animation.xml` の `<animation>` をコピー先の `svgmapAppLayers/Container.svg` 内へ追記します。`CSV_URL_HERE` を匿名閲覧できるCSV配信URLに置換します。Google Sheetsの `/edit` URLはCSVではありません。
4. Next.jsでGoogle Drive写真を安定して表示する場合は、`nextjs/app/api/drive-image/route.js` をコピー先の `app/api/drive-image/route.js` に置きます。このAPIはFile IDと任意の `resourcekey` を受け、画像のContent-Typeを確認して返します。Next.js以外では同等の `/api/drive-image` を提供するか、拡張の直接Google Drive thumbnailへの再試行と共有ページへのリンクを利用してください。
5. HTTPサーバーから開きます。`file://` 直開きではCSV取得やモジュール読込は正常に動きません。

CSV形式は `id,title,lat,lon,imageUrl,description`（0始まりで緯度2、経度3、名称1）です。`title`、`lat`、`lon` が必須、`imageUrl` と `description` は任意です。写真は直接表示できるHTTPS画像URL、または `https://drive.google.com/file/d/FILE_ID/view` 形式の共有URLを使用できます。Drive写真を匿名ユーザーにも見せるには、各画像への閲覧権限が必要です。

このコピーの `CsvMapper.js` はレイヤーURLの `#` 以降を `&` で分割し、`csvPath` をURLデコードしません。そのため、`csvPath` に生の `&` が入るCSV URLや、URL全体を `encodeURIComponent` した値はそのままでは使用できません。`Container-animation.xml` には、追加の `&` がないCSV配信URLを指定してください。このSVG3で使っている `export?format=csv` URLはその条件を満たします。複雑なクエリ付きURLが必要な場合は、CSVを同一オリジンの単純なURLで中継するか、URLパラメータ処理を別途検証して拡張してください。XML属性内のレイヤーパラメータ区切りは `&amp;` と書きます。

シートや写真を更新した後は、公開CSVが更新されればSVGMapの再読み込みで再取得します。SVG3の再ビルドは不要です。オフラインキャッシュはこの共有フォルダには含めていません（ホスト側のService Workerの役割です）。

## 再生成と確認

このリポジトリでは `node scripts/create-csv-photo-share.mjs` で現行ソースからコピーを更新できます。元コードのテストはルートで `npm test` です。
