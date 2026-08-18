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

## 開発フロー

- 改修予定は `ROADMAP.md`(CLAUDE.mdと同じディレクトリに設置)に簡潔な箇条書きで記載する
- 改修を進める際は、ROADMAP.mdの内容からスムーズに実施できる順序を検討して提案する
- 実装前に [docs/architecture.md](docs/architecture.md) を読み、現状のDB構造・API・画面構成・既知の設計判断を把握してから着手する
- ROADMAP.mdやdocs/architecture.mdの更新など、ドキュメント編集にとどまらない実際のコード実装(仕様検討・設計判断を伴う変更)に着手する際は、プランモードに切り替えてから進める
- DB・API・画面構成に変更が入る機能改修をコミットした直後、[docs/architecture.md](docs/architecture.md) の該当箇所を更新する
- 自動モードで機能改修を実施しコミットした後は、プランモードに戻る

### 軽量タスクの委譲

以下の定型作業は、設計判断を伴わないため `docs-editor` / `commit-message-writer` サブエージェント(Haiku)にAgentツールで委譲する。

- ROADMAP.mdへの項目追加・完了項目のクリア → `docs-editor`
- docs/architecture.mdの機械的な更新(表への追記など) → `docs-editor`
- コミットメッセージ案の作成(コミット自体はメインで実行) → `commit-message-writer`

### 動作検証時の注意

ユーザーが手動起動する開発サーバー(`make run`, `:8080`, `data/kondate.db`)とは別に、Claude Codeがpreview系ツールで動作検証を行う際は `.claude/launch.json` の設定により自動的に `:8081` / `data/kondate-preview.db` を使う(ポート・DBとも分離済み)。

## デプロイ

ビルド・デプロイ手順は [README.md](README.md) を参照。
