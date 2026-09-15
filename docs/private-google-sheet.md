# 非公開Google Sheetsを外部CSV現地情報レイヤーへ接続する

Google Sheetとサービスアカウントの鍵は、このリポジトリに書き込まず、
Next.jsサーバー側の環境変数へ設定する。実CSV・実URLを開発者へ渡す必要はない。

1. Google CloudでSheets APIを有効にし、閲覧専用サービスアカウントを作る。
   非公開Sheetを、そのアカウントの `client_email` に**閲覧者**として共有する。
2. [`.env.example`](../.env.example) を参考に、ローカルでは `.env.local`、
   Vercelではプロジェクトの環境変数に次の4項目を設定する。
   `SVG3_PRIVATE_SHEET_ID` はSheet IDまたは `/edit` URL、
   `SVG3_PRIVATE_SHEET_RANGE` は読み取るタブと範囲（例 `Sheet1!A:Z`）、
   `SVG3_PRIVATE_SHEET_COLUMNS` は**0始まり**の列番号、
   `SVG3_GOOGLE_SERVICE_ACCOUNT_JSON` はサービスアカウントJSON全体。
   `.env.local` ではJSON全体を単一引用符で囲み、JSON内の `\n` を保持する。
3. Sheetの1行目からデータとして扱う。**ヘッダー行は不要**。
   今回のSheetは0始まりで `id=0`、`timestamp=1`、`item1=2`、
   `item2〜item5=3〜6`、`lat=7`、`lng=8`、`accuracy=9`、`photoUrl=10`。
   `item1` をtitle、`item2〜item5` の値をラベル付き・改行区切りの説明、
   `photoUrl` をimageUrlに変換する。列設定は
   `{"id":0,"title":2,"lat":7,"lon":8,"imageUrl":10,"descriptionColumns":[3,4,5,6]}`。
   `timestamp` と `accuracy` は出力しない。緯度経度はWGS84の十進数とする。
   完全な空行は無視する。地点名・座標が欠けた行や座標が範囲外の行も
   CSV全体を止めず、その行だけ除外する。Vercelログには行番号と理由だけを残す。
   全行が除外された場合はヘッダーのみのCSVとなり、POIは表示されない。
4. 環境変数を設定した後、ログイン済みのブラウザで
   `/api/private-sheet-csv` が `text/csv` を返すことを確認する。
   出力は `id,title,lat,lon,imageUrl,description` に正規化される。
   元Sheetの余分な列は配信しない。
5. [Container.svg](../svgmapAppLayers/Container.svg) の
   `id="external-csv-photo-layer"` は `csvPath=/api/private-sheet-csv` に接続済み。
   `latCol=2`・`lngCol=3`・`titleCol=1`・`popup=externalCsvPhoto` を維持する。
   GAS本体は変更していない。環境変数が未設定だとAPIは503を返し、
   このレイヤーのPOIは表示されない。

配信は毎回Sheets APIから取得し、Service Workerにも保存しない。
Sheet編集後、地図の再読み込みだけで反映され、CSV更新のための再ビルドは不要。
Driveの `https://drive.google.com/file/d/FILE_ID/view` と
`https://drive.google.com/open?id=FILE_ID` は、サーバーでFile IDと
`resourcekey` を抽出し、署名付きの `/api/private-sheet-image` URLへ変換する。
画像APIは同じサービスアカウントでDrive APIから認証付き取得するため、
Google Cloud側で**Drive APIも有効化**し、写真ファイル（または継承される
フォルダ）をサービスアカウントへ閲覧者として共有する必要がある。
通常のHTTPS直接画像URLは変換せず、従来のpopupで表示する。
写真取得に失敗しても、popupの名称・説明・属性と元Drive共有リンクは残る。
画像APIが受け付けるのはJPEG/PNG/WebP/GIF/AVIF。Drive APIが返す短寿命の
`thumbnailLink` を認証付きで取得し、なければ元画像を取得する。
Vercel応答上限のため、配信する画像は4MB以下に制限する。

**アクセス範囲:** 現在確認したVercelデプロイでは、地図・静的レイヤー・APIが
未ログイン時にSSOへリダイレクトされる。この保護を外すと
`/api/private-sheet-csv` の出力も読めるため、Vercelの保護設定を維持する。
「元Sheetを非公開」と「出力CSVを全員から秘匿」は別である。

Vercel Functionsの応答上限を考慮し、このAPIはUTF-8 CSVが4MBを超える場合
413を返す。大きなSheetでは地域別・範囲別に分割する設計が必要。
