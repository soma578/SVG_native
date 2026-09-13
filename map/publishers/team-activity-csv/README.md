# チーム活動CSV管理（SVG3から移植）

`admin.html` は元SVG3の `map/publishers/team-activity-csv/admin.html` を移植したものです。
CSV選択、地区検索からの活動追加、ひな形保存、ZIP保存、プロジェクトへの書き出しを備えます。
地図のコントローラーにある「SVGMap App Layers管理」から開くか、
`/map/publishers/team-activity-csv/admin.html` を直接開けます。

入力は元SVG3と同じ10列です。

```csv
id,title,prefecture,municipality,districtName,status,summary,description,area,operator
```

地区索引から緯度経度と自治体コードを解決し、元SVG3の
`map/publishers/shared/csvQtctPipeline.mjs` でQTCTを生成します。
このホストではさらに `runtimeCsv.mjs` が11列の `current.csv` を生成します。
`current.csv` は現在のSVGMapチーム活動レイヤーが開くたびに取得し、
ピンと活動エリアを一体表示する配信用データです。

「プロジェクトへ書き出す」では、このリポジトリのルート（`package.json` がある場所）を選びます。
元CSV、公開状態、QTCT、`current.csv` とそれらの `public/` 配信用コピーを書き込みます。
ローカルの `npm run dev` 中なら地図の再読み込みで新しいピン・エリアを確認できます。
ブラウザからVercel上のファイルは変更できません。公開サイトへの反映には変更をコミットして再デプロイします。

File System Access API非対応ブラウザではZIPを保存し、リポジトリのルートへ展開して
`npm run assets:prepare` を実行します。ZIP内の相対パスはプロジェクトルート基準です。

元SVG3からの変更は、地区索引を `/map/data/district-indexes/` から読む点、
戻り先を `/svgmap.html` とする点、書き出し先をプロジェクトルートにする点、
表示用11列CSVと `public/` コピーを追加生成する点です。
元SVGMapの `csvXhr_r20.svg` や `CsvMapper.js` は変更していません。
