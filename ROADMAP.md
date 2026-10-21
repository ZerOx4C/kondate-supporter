# ROADMAP

改修予定を簡潔な箇条書きで記載する。
消化していく際は全体から適切な作業順序を検討してから実施する。

- プロジェクト初期構築(`go.mod`、`cmd/server`、`internal/{config,db,model,repository,service,handler}`、`web/static` のディレクトリ作成)
- `recipes` テーブルのマイグレーション作成(`id`, `name`, `body`)
- レシピのCRUD API(`GET/POST /api/recipes`, `GET/PUT/DELETE /api/recipes/{id}`)
- `recipes.html`: レシピの一覧表示(カードリスト)・新規作成・詳細表示・編集・削除ダイアログ(name入力欄 + bodyのtextareaのみ)
- `make run` での開発起動、`make build-rpi` でのRaspberryPi Zero向けビルド
