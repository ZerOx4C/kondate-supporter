# kondate-supporter

## プロジェクト概要

家庭内LAN限定で動く個人利用の献立管理ツール。RaspberryPi Zero(ARMv6・低メモリ)にデプロイし、常時稼働させる。外部には一切公開しないため、認証・HTTPS化・CSRF対策等は現時点でスコープ外。

PCブラウザ・スマートフォン・タブレットなど複数の端末から家庭内LAN経由でアクセスする想定。

- スマホやタブレットからの利用も想定するため、マウス操作とタッチ操作の両方に対応する
- レスポンシブUI化は必要なUIや大まかな遷移が定まってから行うため今は実施しない

### 機能

- 冷蔵庫の在庫記録
- レシピの登録
- 献立(日付・レシピ・人数)の登録
- 買い物リストの生成(登録した献立に対し、在庫が不足している食材を算出)
- 材料の単位(g、本、個など)の管理(マスタ化はせず食材ごとに文字列で保持)

## 技術スタック(変更不可の制約)

- バックエンド: Go + 標準 `net/http` のみ(Gin/Echo等の追加Webフレームワークは導入しない)
- DB: SQLite、ドライバは `modernc.org/sqlite`(CGO不要な純Go実装。CGO必須の `mattn/go-sqlite3` はRaspberryPi Zero向けクロスコンパイルが煩雑になるため不採用)
- フロントエンド: 素のHTML/CSS/JavaScript(フレームワーク・ビルドツールなし、SPA化もしない)
- 個人利用専用。チーム開発向けの過剰な抽象化は避ける。

## ディレクトリ構成

```
cmd/server/main.go       # エントリポイント(DBオープン→マイグレーション適用→ルーティング登録→ListenAndServe)
internal/config/         # 設定(ポート・DBパス等を環境変数/フラグで受け取る)
internal/db/             # sql.DBオープン、マイグレーション実行
internal/db/migrations/  # SQLマイグレーションファイル(embedでバイナリに焼き込み)
internal/model/          # ドメイン構造体
internal/repository/     # DBアクセス層(SQL実行のみ)
internal/service/        # ビジネスロジック層(買い物リスト算出など)
internal/handler/        # HTTPハンドラ層
web/static/               # フロントエンド(HTML/CSS/JS、embedでバイナリに焼き込み)
scripts/                  # ビルド・デプロイ補助スクリプト
data/                     # SQLiteファイルの実行時生成先(Git管理外)
```

依存の方向は `handler → service → repository` の一方向。上位層は下位層のみに依存する。

## 開発規約

- 新規の外部依存パッケージを追加する前に、標準ライブラリで実現できないか検討する
- DBアクセスは repository 層に閉じ込め、handler から直接SQLを書かない
- 買い物リスト算出などのビジネスロジックは service 層に置く
- 食材の数量・単位は「食材ごとに固定単位」ルールを厳守し、単位換算ロジックは持たない
- APIレスポンスはJSON、エラーは `{"error": "message"}` 形式で統一する
- マイグレーションファイルは追記のみ(既存ファイルの内容変更は禁止)

## RaspberryPi Zero向けビルド・デプロイ手順

1. クロスコンパイル: `make build-rpi`
   (`GOOS=linux GOARCH=arm GOARM=6 CGO_ENABLED=0 go build -o bin/kondate-supporter-armv6 ./cmd/server`)
2. 転送: `scp bin/kondate-supporter-armv6 pi@<host>:/home/pi/kondate-supporter/`
3. RaspberryPi Zero上でsystemdサービスとして登録し常時稼働させる
4. DBファイルは `data/kondate.db` に配置され、起動時に未適用のマイグレーションが自動実行される

## 注意事項

- 外部公開を前提としない(HTTPS化・認証・CSRF対策等は現時点でスコープ外)
- RaspberryPi Zeroのメモリ制約を常に意識し、依存追加や常駐メモリ増加には慎重になること
