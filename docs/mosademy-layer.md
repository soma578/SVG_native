# MOSAdemy 設備監視（岡山大学医学部）レイヤー

岡山大学グループ内の独立したSVGMapレイヤーです。先方の公開 [svgmap-data.js](https://mosa-github.github.io/data_test_server_page/assets/svgmap-data.js) をブラウザから直接読み込み、その `loadApprovedSensors()`・`showSensor()` を利用します。データの入口は先方の [public-data catalog](https://mosa-github.github.io/data_test_server_page/public-data/catalog.json) です。Google Sheetへの複製や認証キーは不要です。

標準プロパティには施設名・計測値・カメラ画像に加えて「出典」と「出典公式ページ」を載せます。出典リンクは [MOSAdemy の公開ページ](https://mosa-github.github.io/data_test_server_page/) です。操作画面の長い説明文は表示しません。

- 公開されている `updatePoiLayer()` はセンサIDごとにPOIを作る汎用例ですが、このデータでは複数POIが同じ施設座標に重なるため使用しません。HLMap側で施設IDごとに1ピンへまとめます。現在の公開表示はSVGMapメタデータの表形式で、施設の燃料・水位残量・電力・カメラを1ピンから確認できます。従来のセンサ選択ボタンと先方の `showSensor()` を使う独自詳細画面もコードに残してあり、開発者設定で復元できます（[表示方式](okayama-property-view.md)）。
- 燃料残量はL、水位残量は設備内の残量%、電力はWです。電池残量や浸水深として表示しません。
- 3分ごとに再取得します。公開配信側のHTTPキャッシュが10分の場合、必ずしも3分以内に新値にはなりません。現在のピンは施設の単一アイコンです。
- 取得失敗時は直前に成功したピンを保持し、操作画面にエラーを表示します。
- JSONとJavaScriptは公開GitHub Pagesから直接取得します。URLと画像URLの検証は先方の `svgmap-data.js` に従います。先方がスクリプトを変更するとHLMapにも反映されるため、表示仕様変更時は互換性を再確認してください。
- 先方のJavaScriptはHLMapの同一オリジンWebAppレイヤー内で実行されます。`data-lawa-mode="isolated"` は現構成では初期化できなかったため使っていません。信頼境界を強める場合は、先方のコードを別オリジンのS-LaWAとして動かす構成を別途検討してください。

ローカル検証は `npm run assets:prepare` と `npx playwright test tests/mosademy-layer.spec.mjs` で行えます。レイヤーは初期状態でOFFです。
