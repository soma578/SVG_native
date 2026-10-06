# 水ピィ杭受信API

`POST /api/mizupigui`。認証ヘッダは `X-API-Key`、Content-Type は `application/json`。APIキーをURLやブラウザ側のコードに入れない。

更新された杭1件を送る場合:

```json
{
  "id": "A001",
  "name": "1号杭",
  "lat": 34.5231,
  "lng": 133.6712,
  "waterLevel": 1,
  "tiltDetected": false,
  "batteryOk": true,
  "lastReceivedAt": "2026-09-10T08:47+09:00"
}
```

従来提示された `{ "updatedAt": "...", "stakes": [ ... ] }` 形式も受け付ける（1～100件）。`waterLevel` は `0`・`1`・`2`・`null`、`tiltDetected` は真偽値・`null`、`batteryOk` は真偽値。日時にはタイムゾーンを付ける。1リクエストの上限は64 KiB。

専用Google Spreadsheetに `history` シートを作り、1行目を以下の順で設定する。`MIZUPIGUI_SHEET_NAME` でシート名を変更できる。

```text
receivedAt,id,name,lat,lng,waterLevel,tiltDetected,batteryOk,lastReceivedAt,updatedAt
```

既存の `SVG3_GOOGLE_SERVICE_ACCOUNT_JSON` の `client_email` に、そのSpreadsheetの編集権限を付与する。Vercelのサーバー側環境変数に `MIZUPIGUI_SHEET_ID` と32文字以上のランダムな `MIZUPIGUI_API_KEY` を設定する。実値はGitに保存しない。キーは別の安全な経路でlogpot側に渡す。

保存を確認した新規イベントには201、既に保存済みの `id + lastReceivedAt` には200を返す。入力不正は400、認証不正は401、未設定・Sheets障害は503を返す。503または通信タイムアウト時は送信元で再送してもらう。Sheetsは原子的な一意制約を持たないため、同時に届いた同一イベントの厳密な重複排除は保証しない。低頻度の受信履歴向けの実装で、厳密な一意性が必要ならトランザクション対応DBへ切り替える。

デプロイ後、実際の本番URLに認証なし・誤認証・正常データ・同じデータの再送を試し、Sheetの行数と各HTTP応答を確認してから相手にURLを案内する。URLだけで利用可能とは案内しない。
