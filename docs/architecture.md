# 設計概要

コード構成・DB・API・画面の現状と、逆行を防ぐための設計判断をまとめる。
1〜4節は実装時に `programmer` が実態へ合わせて更新し、5節はメインエージェントが設計判断の都度更新する。

> v1実装着手前の計画段階の内容を含む。実装で変わった箇所は実態に合わせて書き換えること。

## 1. コード構成

```
cmd/server/main.go       # エントリポイント(DBオープン→マイグレーション適用→ルーティング登録→ListenAndServe)
internal/config/         # 設定(ポート・DBパス等を環境変数で受け取る)
internal/db/             # sql.DBオープン、マイグレーション実行
internal/db/migrations/  # SQLマイグレーションファイル(embedでバイナリに焼き込み)
internal/model/          # ドメイン構造体
internal/repository/     # DBアクセス層(SQL実行のみ)
internal/service/        # ビジネスロジック層
internal/handler/        # HTTPハンドラ層
web/static/              # フロントエンド(HTML/CSS/JS、embedでバイナリに焼き込み)
scripts/                 # ビルド・デプロイ補助スクリプト
data/                    # SQLiteファイルの実行時生成先(Git管理外)
```

## 2. DBスキーマ

### `recipes`(レシピ)
| カラム | 型/制約 |
|---|---|
| id | INTEGER PRIMARY KEY |
| name | TEXT NOT NULL(タイトル) |
| body | TEXT NOT NULL DEFAULT ''(材料・調味料・手順を含む自由テキスト) |

### `schema_migrations`(マイグレーション適用履歴)
| カラム | 型/制約 |
|---|---|
| name | TEXT PRIMARY KEY(マイグレーションファイル名) |
| applied_at | TEXT NOT NULL DEFAULT (datetime('now')) |

`internal/db/db.go` の `Migrate()` が `internal/db/migrations/*.sql` を未適用のものだけファイル名昇順・1ファイル1トランザクションで適用する。

## 3. APIエンドポイント

ルーティングは `internal/handler/router.go` の `NewRouter()` に集約する(Go 1.22以降のメソッド付きパターン)。

| メソッド パス | 概要 |
|---|---|
| GET /healthz | 死活監視用(`{"status":"ok"}`固定) |
| GET /api/recipes | レシピ一覧取得 |
| POST /api/recipes | レシピ新規作成(name, body) |
| GET /api/recipes/{id} | レシピ1件取得 |
| PUT /api/recipes/{id} | レシピ更新(name, body) |
| DELETE /api/recipes/{id} | レシピ削除 |
| GET / | ルートパスのみ `/recipes.html` へリダイレクト(302)。それ以外は静的ファイル配信(embed。`DEV_MODE=1` のときのみ `os.DirFS("web/static")` から配信) |

エラー応答は `internal/handler/respond.go` で生成する。

## 4. 画面

| 画面 | 内容 | 状態 |
|---|---|---|
| `recipes.html`(レシピ) | 縦積みカードリスト表示・新規作成・詳細表示・編集・削除。詳細/編集は `<dialog>`(name入力欄 + bodyのtextareaのみ) | 計画中 |

## 5. 設計判断(逆行防止用)

- **レシピ本文は構造化しない**: 材料・調味料・手順は `body` 1カラムの自由テキストに持たせる。名称+数量+単位での構造化やLLMによる抽出はROADMAPに項目が無い限り着手しない。
- **在庫・献立・買い物リストは現時点のスコープ外**: 関連するテーブル・APIはROADMAPに項目が追加されるまで作らない。
