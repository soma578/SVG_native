# MOSAdemy 設備監視レイヤー

岡山大学グループ内の独立したSVGMapレイヤーです。公開承認済みの [MOSAdemy public-data catalog](https://mosa-github.github.io/data_test_server_page/public-data/catalog.json) を読み、`latest.json`・`locations.json`・`cameras.json` を施設IDで結合します。Google Sheetへの複製や認証キーは不要です。

- 施設単位に1つのピンを表示し、クリックでセンサ値・計測日時・静止画を表示します。画像はクリック時だけ読み込みます。
- 燃料残量はL、水位残量は設備内の残量%、電力はWです。電池残量や浸水深として表示しません。
- 3分ごとに再取得します。公開配信側のHTTPキャッシュが10分の場合、必ずしも3分以内に新値にはなりません。計測日時が30分を超えて古い施設は灰色で示します。
- 取得失敗時は直前に成功したピンを保持し、操作画面にエラーを表示します。
- JSONは公開GitHub Pagesから直接取得します。取得先と画像URLは `model.js` で公開データのパスに限定しています。

ローカル検証は `node svgmapAppLayers/appLayers/mosademy/model.test.mjs` と `npm run assets:prepare` で行えます。レイヤーは初期状態でOFFです。
