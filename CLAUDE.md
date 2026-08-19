# kondate-supporter

## プロジェクト概要

外部公開せず家庭内LAN限定で動く個人利用の献立管理ツール。
RaspberryPi Zero(ARMv6・低メモリ)にデプロイし、常時稼働させる。
PCブラウザ・スマートフォン・タブレットなど複数の端末から家庭内LAN経由でアクセスする想定。

- スマホやタブレットからの利用も想定するため、マウス操作とタッチ操作の両方に対応する
- レスポンシブUI化は必要なUIや大まかな遷移が定まってから行うため今は実施しない

### 機能

- 冷蔵庫の在庫記録
- レシピの登録
- 献立(日付・レシピ・人数)の登録
- 買い物リストの生成(登録した献立に対し、在庫が不足している食材を算出)
- 材料の単位(g、本、個など)の管理(マスタ化はせず食材ごとに文字列で保持)

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

## 技術スタック・開発規約

変更不可の技術制約、実装規約、注意事項は [docs/development.md](docs/development.md) を参照。
外部パッケージの追加検討時、アーキテクチャ判断時、実装規約を確認したい時に読むこと。

## 作業フロー

### メッセージ内容に応じて対応を振り分ける

- 改修内容が書かれている場合はROADMAP更新を開始する
- 作業開始指示である場合は実装作業を開始する
- これらに該当しない場合は適宜対応する (CLAUDE.mdに関する相談など)

### ROADMAP更新

1. 改修内容に不明瞭な点があればヒアリングを行う
2. 明瞭化された改修内容を適切な粒度に分解する
3. 分解した改修内容を [ROADMAP.md](ROADMAP.md) に箇条書きで記載する (サブエージェント`docs-editor`へ委譲)

### 実装作業

1. 必ずプランモードに切り替える
2. [ROADMAP.md](ROADMAP.md) と [docs/architecture.md](docs/architecture.md) を読み、どの項目から着手すると良いか検討して提案する
3. ヒアリング結果に応じた実装作業と [docs/architecture.md](docs/architecture.md) の更新を行う (サブエージェント`programmer`へ委譲)
4. コミットメッセージを検討する (サブエージェント`commit-message-writer`へ委譲)
5. 実装内容をコミットする
6. [ROADMAP.md](ROADMAP.md) から完了項目を削除し (サブエージェント`docs-editor`へ委譲)、必要ならコミットする
7. プランモードへ戻る

## 動作検証時の注意

ユーザーが手動起動する開発サーバー(`make run`, `:8080`, `data/kondate.db`)とは別に、Claude Codeがpreview系ツールで動作検証を行う際は `.claude/launch.json` の設定により自動的に `:8081` / `data/kondate-preview.db` を使う(ポート・DBとも分離済み)。

## サブエージェント情報

- `programmer`: Sonnet
- `docs-editor`: Haiku
- `commit-message-writer`: Haiku

## デプロイ

ビルド・デプロイ手順は [README.md](README.md) を参照。
