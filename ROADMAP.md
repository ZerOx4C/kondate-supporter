# ROADMAP

改修予定を、マイルストーン単位の見出しの下に簡潔な箇条書きで記載する。
現在着手中のマイルストーンの項目のみを実装対象とし、先のマイルストーンの先行実装は行わない。

## v1: レシピ登録(現在のマイルストーン)

- プロジェクト初期構築(`go.mod`、`cmd/server`、`internal/{config,db,model,repository,service,handler}`、`web/static` のディレクトリ作成)
- `recipes` テーブルのマイグレーション作成(`id`, `name`, `body`)
- レシピのCRUD API(`GET/POST /api/recipes`, `GET/PUT/DELETE /api/recipes/{id}`)
- `recipes.html`: レシピの一覧表示(カードリスト)・新規作成・詳細表示・編集・削除ダイアログ(name入力欄 + bodyのtextareaのみ)
- `make run` での開発起動、`make build-rpi` でのRaspberryPi Zero向けビルド

## v2: 献立登録(未着手・詳細化は v1 完了後)

- 日付・レシピ・人数を紐づけて登録できる献立機能
