# SVGMap 外部CSV＋写真POIレイヤー

本家 [svgmap/svgmapAppLayers](https://github.com/svgmap/svgmapAppLayers) のCSVレイヤーを利用し、外部公開CSVの地点に写真付きpopupを追加する共有パッケージです。CSVの取得・座標からのPOI生成・描画は本家由来の `csvXhr_r20.svg` / `CsvMapper.js` が担当します。地図上のピンは本家の標準アイコンで、写真サムネイル型のピンではありません。

## 本家CSVレイヤーの仕様（このパッケージに同梱した版）

- `Container.svg` の `<animation>` から `csvXhr_r20.svg` を参照し、URLフラグメントで `csvPath`、`latCol`、`lngCol`、`titleCol` を渡します。列番号は0始まりです。
- `CsvMapper.js` が `csvPath` へブラウザからXHRでアクセスし、緯度・経度をPOIの位置、`titleCol` をPOI名として使います。CSVの各列はクリック時に参照できる属性として保持されます。
- `csvXhr_r20.svg` は標準のピンアイコンとCSV用コントローラ `csvUI_r20.html` を持ちます。大量データ向けの既存QTCT処理も同梱したままです。
- 外部CSVは閲覧者のブラウザから取得されるため、CSV配信元は匿名閲覧と必要なCORS許可が必要です。Google Sheetsの編集画面（`/edit`）はCSVではありません。

この同梱版の `CsvMapper.js` はフラグメントを生の `&` で分割し、`csvPath` をURLデコードしません。したがって `csvPath` 自体に `&` があるURLや、URL全体を `encodeURIComponent` した値はそのまま渡せません。例の `.../export?format=csv` のような、追加の `&` を含まないCSV URLを使ってください。複雑なURLが必要なら、同一オリジンの単純なCSV中継URLを用意するか、パラメータ解析を別途検証してください。XML内でレイヤーパラメータを区切る `&` は `&amp;` と記述します。

## 本家からの変更点

| ファイル | 変更・役割 |
| --- | --- |
| `svgmapAppLayers/authoringLayers/local/csvLayer/externalCsvPhotoPopup.js` | 追加。`popup=externalCsvPhoto` を指定したレイヤーだけ、名称・写真・説明・CSV属性を表示します。 |
| `svgmapAppLayers/authoringLayers/local/csvLayer/csvUI_r20.html` | 上記拡張を読み込むimportを追加。 |
| `nextjs/app/api/drive-image/route.js` | 追加。Google Driveの共有写真を画像として取得するNext.js用API。 |
| `Container-animation.xml` / `sample.csv` | 設置例と入力例。 |

`csvXhr_r20.svg`、`CsvMapper.js`、本家のCSV解析・QTCT・ピン描画処理は、この写真対応のためには変更していません。写真popupも `popup=externalCsvPhoto` がない他のCSVレイヤーには適用されません。

写真拡張は、通常のHTTPS画像URLを直接表示します。`https://drive.google.com/file/d/FILE_ID/view` と `https://drive.google.com/open?id=FILE_ID` はDrive共有ページとして識別し、File IDと任意の `resourcekey` を画像取得URLへ引き継ぎます。共有ページURLをそのまま `<img>` に指定しません。Next.js APIがあればまず `/api/drive-image` を使い、失敗時にはDriveのthumbnail URLを試します。それも失敗した場合は「画像を表示できません」と、元の共有URLを開くリンクを表示します。Drive画像の取得可否は、ファイルの公開権限とGoogle側の配信状態に依存します。

CSV由来の文字列はDOMの `textContent` で表示します。画像URLはURLとして検証し、通常はHTTPSのみ許可します（HTTPは明示的なローカル開発環境のみ）。`javascript:`、`data:`、`file:`、`blob:` は画像URLとして使用しません。Drive専用処理は `drive.google.com` の完全一致だけを対象にします。

## 使用方法

1. コピー先に動作するSVGMap本体と互換性のある `svgmapjs` / `svgmapAppLayers` を用意します。この共有フォルダだけでは地図本体は起動しません。
2. `svgmapAppLayers/authoringLayers/local/csvLayer/` をコピー先の同じ位置へ配置します。既に本家CSVレイヤーがある場合は、上書き前に差分を確認してください。元のシンボリックリンクはこの共有パッケージ内では実ファイルとしてコピーされています。ライセンスは `svgmapAppLayers/LICENSE` を参照してください。
3. `Container-animation.xml` の `<animation>` をコピー先の `svgmapAppLayers/Container.svg` 内に追加し、`CSV_URL_HERE` を匿名アクセスできる実際のCSV配信URLに置換します。Google Sheetsを使う場合は「ウェブに公開」したCSV URL、または匿名でCSVレスポンスを返すエクスポートURLを使い、`/edit` URLは使いません。CSV URLに `&` がないことも確認してください。
4. Google Drive共有リンクを写真列に入れる場合、Next.jsホストでは `nextjs/app/api/drive-image/route.js` を `app/api/drive-image/route.js` へ配置します。Next.js以外では同等のAPIを実装するか、thumbnailへの再試行と共有ページへのフォールバックのみを利用します。
5. HTTP(S)サーバーで地図を開き、レイヤー「外部CSV現地情報」を有効にします。`file://` での直開きは対象外です。POIをクリックすると写真・説明・CSV属性が表示されます。

想定CSVの列順は次のとおりです。`title`、`lat`、`lon` が必須で、`imageUrl` と `description` は任意です。

```csv
id,title,lat,lon,imageUrl,description
001,地点A,34.6651,133.9180,https://example.com/images/001.jpg,地点Aの説明
002,地点B,34.6702,133.9251,https://drive.google.com/file/d/FILE_ID/view?usp=sharing,地点Bの説明
```

列番号は `id=0`、`title=1`、`lat=2`、`lon=3`、`imageUrl=4`、`description=5` です。`Container-animation.xml` の `latCol=2`、`lngCol=3`、`titleCol=1` はこの順序に対応します。写真を出すには、直接表示できるHTTPS画像URL、または閲覧者が匿名で開けるGoogle Driveファイル共有URLを `imageUrl` に入れます。Driveフォルダだけでなく、対象ファイル自体の匿名閲覧可否も確認してください。GoogleのログインCookieがある状態だけでの確認は不十分です。

CSVはSVGMapを開くたびに配信URLから取得する構成なので、公開CSVやDrive写真の変更のためにSVG3を再ビルドする必要はありません。ただし、公開CSVへの反映遅延やホスト側のキャッシュ設定により、再読み込み直後に最新値にならない場合があります。この共有フォルダにService Workerは含みません。Next.js APIもDrive画像を永続保存せず、レスポンスに `private, no-cache` を設定します。

## パッケージの再生成・確認

このリポジトリでは `node scripts/create-csv-photo-share.mjs` で現行ソースから共有用コピーを更新できます。元コードのテストはリポジトリのルートで `npm test` を実行します。共有フォルダ単体にはSVGMap本体・テスト実行環境は含みません。
