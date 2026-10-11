# 水ピィ杭受信API

`POST /api/mizupigui` は、logpotから1リクエストにつき杭のログ1件を受信する。認証キーはURLやブラウザコードに入れない。

```http
Content-Type: application/json
X-API-Key: <別経路で共有したキー>
X-Logpot-Retry-Count: 0
```

`X-Logpot-Retry-Count` は必須で、最初の送信は `0`、再送は `1`～`4`。それ以外は400を返す。

```json
{
  "logId": "log-001",
  "id": "A001",
  "name": "1号杭",
  "lat": 34.5231,
  "lng": 133.6712,
  "waterLevel": 1,
  "tiltDetected": false,
  "batteryOk": true,
  "lastReceivedAt": "2026-09-10T08:47:00+09:00",
  "floodedAt": null
}
```

`logId` は必須の重複判定キー。`lat`・`lng`・`floodedAt` は `null` 可。`waterLevel` は `0`・`1`・`2`・`null`、`tiltDetected` と `batteryOk` は真偽値のみ。日時は秒と `+09:00` を含む。旧 `{ "updatedAt": "...", "stakes": [...] }` 形式は受け付けない。本文上限は64 KiB。

専用Google Spreadsheetに `history` と `latest` の2タブを用意する。各タブの1行目は、次の順序・大文字小文字で設定する。既存の `history` を再利用してよく、`history_v2` は必須ではない。ただし、旧ヘッダのままでは503になる。旧テスト行がある場合は新形式との混在を避けて整理する。

```text
history:
receivedAt,retryCount,logId,id,name,lat,lng,waterLevel,tiltDetected,batteryOk,lastReceivedAt,floodedAt

latest:
id,name,lat,lng,waterLevel,tiltDetected,batteryOk,lastReceivedAt,floodedAt,logId,receivedAt,retryCount
```

Vercelのサーバー側環境変数は以下を設定する。値の実体はGitに保存しない。

```text
MIZUPIGUI_API_KEY=<32文字以上のランダムキー>
MIZUPIGUI_SHEET_ID=<Spreadsheet ID>
MIZUPIGUI_SHEET_NAME=history
MIZUPIGUI_LATEST_SHEET_NAME=latest
SVG3_GOOGLE_SERVICE_ACCOUNT_JSON=<編集権限を持つサービスアカウント>
```

`MIZUPIGUI_SHEET_NAME` と `MIZUPIGUI_LATEST_SHEET_NAME` はそれぞれ `history` と `latest` がデフォルト。既存の `SVG3_GOOGLE_SERVICE_ACCOUNT_JSON` の `client_email` に、そのSpreadsheetの編集権限を付与する。

新しい `logId` を履歴に保存できた場合は201、保存済みの場合は200。`latest` は同じ杭IDにつき1行とし、受信ログの `lastReceivedAt` が現在値より新しいときだけ更新する。履歴の保存後に `latest` が失敗した場合は503を返し、同じ `logId` の再送で履歴を増やさず `latest` を修復する。入力不正は400、認証不正は401、未設定・Sheets障害・7.5秒の保存タイムアウトは503。

Google Sheetsには原子的な一意制約や条件付き更新がないため、複数の関数インスタンスへ同時に届いた同じ `logId` の厳密な重複防止や、同一杭への並行更新の順序保証はできない。先方が同じ杭を並列送信する運用なら、トランザクション対応の保存先を検討する。

`GET /api/mizupigui` は公開地図用に `latest` タブの最新状態を返す。認証キー・`logId`・履歴全件は返さず、`{ "updatedAt": "...", "stakes": [...] }` の形式で位置、水位、傾斜、電池、最終受信、浸水開始だけを返す。応答は `no-store`。岡山大学の「水ピィ杭 最新状態（logpot）」レイヤーが約1分ごとに取得する。座標 `null` の杭は件数に含まれるが、ピンは表示しない。

本番への書き込み試験はデプロイ後に `MIZUPIGUI_TEST_URL` と `MIZUPIGUI_TEST_KEY` を設定し、`node scripts/test-mizupigui-live.mjs` を手動実行する。新規ログの201、同一 `logId` 再送の200、GETの反映を確認する。試験用 `TEST-...` 行は `history` と `latest` の両方に残るため、Sheetを目視確認した後に両タブから削除する。キー本体はGit・コマンド履歴に残さない。

デプロイ後、認証なし・誤認証・正常データ・同じ `logId` の再送・より古い `lastReceivedAt` の送信を本番URLで試し、両タブの行数とHTTP応答を確認してから相手にURLを案内する。実データを送る前にテスト用 `logId` を決め、残った試験行を記録・整理する。
