# 設計概要メモ

現状のDB構造・API・画面構成・既知の設計判断をまとめたスナップショット。
CLAUDE.mdの開発フローに従い、DB/API/画面に変更が入る機能改修をコミットした直後に更新すること。

> 本ドキュメントはv1実装着手前に作成した計画スナップショット。実装時に内容が変わった場合は、実装直後に実態へ合わせて修正すること。

## 1. DBスキーマ(v1時点)

### `recipes`(レシピ)
| カラム | 型/制約 |
|---|---|
| id | INTEGER PRIMARY KEY |
| name | TEXT NOT NULL(タイトル) |
| body | TEXT NOT NULL DEFAULT ''(材料・調味料・手順を含む自由テキスト) |

材料・調味料・手順をカラム/別テーブルに分けず、`body` 1カラムの自由テキストとして保持する。構造化(名称+数量+単位での管理)はv1のスコープ外。

### `schema_migrations`(マイグレーション適用履歴)
| カラム | 型/制約 |
|---|---|
| name | TEXT PRIMARY KEY(マイグレーションファイル名) |
| applied_at | TEXT NOT NULL DEFAULT (datetime('now')) |

`internal/db/db.go` の `Migrate()` が `internal/db/migrations/*.sql` を未適用のものだけファイル名昇順・1ファイル1トランザクションで適用する。

## 2. APIエンドポイント一覧(v1時点)

ルーティング登録は `internal/handler/router.go` の `NewRouter()` に集約する(Go 1.22以降のメソッド付きパターンを使用)。

| メソッド パス | 概要 |
|---|---|
| GET /healthz | 死活監視用(`{"status":"ok"}`固定) |
| GET /api/recipes | レシピ一覧取得 |
| POST /api/recipes | レシピ新規作成(name, body) |
| GET /api/recipes/{id} | レシピ1件取得 |
| PUT /api/recipes/{id} | レシピ更新(name, body) |
| DELETE /api/recipes/{id} | レシピ削除 |
| GET / | ルートパスのみ `/recipes.html` へリダイレクト(302)。それ以外は静的ファイル配信(web/static、embedでバイナリに焼き込み。`DEV_MODE=1` のときのみ `os.DirFS("web/static")` から配信) |

エラー応答は全て `{"error": "メッセージ"}` 形式(`internal/handler/respond.go`)。

## 3. 画面一覧(v1時点)

| 画面 | 内容 | 状態 |
|---|---|---|
| `recipes.html`(レシピ) | レシピの縦積みカードリスト表示・新規作成・詳細表示・編集・削除。詳細/編集は `<dialog>` で開く(name入力欄 + bodyのtextareaのみ) | 計画中 |

## 4. 既知の設計判断・方針(逆行防止用)

- **小さく完成させることを最優先する**: レシピの材料・調味料・手順を構造化せず自由テキスト(`body`)1カラムに持たせる。構造化やブラウザ内/ローカルLLMによる抽出は[ROADMAP.md](../ROADMAP.md)に項目が無い限り着手しない。
- **在庫・献立・買い物リストは現時点のスコープ外**: これらに依存するテーブル・APIは[ROADMAP.md](../ROADMAP.md)に項目が追加されるまで作成しない。
