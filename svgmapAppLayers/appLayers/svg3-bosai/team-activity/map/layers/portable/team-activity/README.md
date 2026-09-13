# Team Activity Portable Layer

同梱の `current.csv`（または `sourceCsv` で指定した配信CSV）を開くたびに取得し、
その内容をピンと活動エリアの正本として表示する SVGMap portable layer。
CSVの取得に失敗した時のみ、同梱の静的QTCTを予備表示に使用する。
ピンと活動エリアは同じレイヤー内で描画し、1つの表示切り替えに連動する。

利用者向けの「CSVを追加」はレイヤー本体に含まれる。配信中のCSVを置換せず、
そのブラウザ内で追加QTCTとして合成するため、低ズームの密度表示と高ズームの個別ピンを共有する。
ひな形の列順は `id,title,regionId,municipalityCode,lat,lon,status,summary,description,area,operator`。
`regionId` と `municipalityCode` はエリア境界の取得に必要。CSVの各行がピンになり、
緯度経度が一致する地区境界だけが活動エリアとして表示される。
運用者が元SVG3形式の10列CSVを編集・保存する画面は次に分離している。

```text
map/publishers/team-activity-csv/admin.html
```

この配置で実行時に読むCSV:

```text
svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/layers/portable/team-activity/current.csv
```

別ホストのCSVを正本にする場合は、`Container.svg` の `sourceCsv` を公開URLへ変更する。
そのURLは上記11列のCSVを返し、閲覧者のブラウザから匿名アクセス（必要ならCORS許可）できること。
元のSVG3にある `prefecture,municipality,districtName` 形式のビルド用CSVは
緯度経度を含まないため、この実行時入力へそのまま渡せない。
`current.csv` をホスト内の静的ファイルとして更新する場合、公開ファイルの差し替えは必要だが
QTCTの再生成は不要。外部配信URLならCSV更新後の地図再読み込みだけでよい。

管理画面でプロジェクトルートを選択して保存すると、元CSVからQTCTと
この `current.csv` が生成される。ローカル開発中は地図を再読み込みする。
公開Vercelへの反映にはコミットと再デプロイが必要。
代表ピンのサイズは固定。画面内の件数がズーム別閾値を超えるたびに1本増え、
QTCT内の件数比に応じて高密度地域へ配分される。

クリーンな `svgmapAppLayers` へ一式を配置し `Container.svg` へ登録する例:

```bash
node scripts/install-team-activity-applayer.mjs /path/to/svgmapAppLayers
```

これはローカルディレクトリだけを書き換え、上流リポジトリへの通信は行わない。
配置後はコントローラーの「SVGMap App Layers管理」から元SVG3の
`/map/publishers/team-activity-csv/admin.html` を開ける。

SVGMap からの利用例:

```xml
<animation
  xlink:href="/map/layers/portable/team-activity/teamActivityLayer.svg#summary=/map/data/qtct/teamActivity/summary.json&amp;data=/map/data/qtct/teamActivity/okayama/detail.json&amp;sourceCsv=./current.csv&amp;districtSvgUrlTemplate=/map/data/districts/{recordRegionId}/districts-svg/{code}.svg&amp;layer=teamActivity"
  title="チーム活動"
  class="poi clickable"
  visibility="hidden"
  opacity="1" />
```
