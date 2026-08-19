# 設計概要メモ

現状のDB構造・API・画面構成・既知の設計判断をまとめたスナップショット。
CLAUDE.mdの開発フローに従い、DB/API/画面に変更が入る機能改修をコミットした直後に更新すること。

## 1. DBスキーマ(最新状態)

### `ingredients`(食材マスタ)
| カラム | 型/制約 |
|---|---|
| id | INTEGER PRIMARY KEY |
| name | TEXT NOT NULL UNIQUE |
| unit | TEXT NOT NULL(食材ごとに固定の単位文字列。マスタ化せず自由入力) |

### `seasonings`(調味料マスタ)
| カラム | 型/制約 |
|---|---|
| id | INTEGER PRIMARY KEY |
| name | TEXT NOT NULL UNIQUE |

`unit`カラムを持たない。数量は常にmL固定という前提でAPI/画面側が扱う(在庫管理の対象外)。

### `stocks`(食材在庫)
| カラム | 型/制約 |
|---|---|
| id | INTEGER PRIMARY KEY |
| ingredient_id | INTEGER NOT NULL UNIQUE REFERENCES ingredients(id) |
| quantity | REAL NOT NULL DEFAULT 0 |
| updated_at | TEXT NOT NULL DEFAULT (datetime('now')) |

### `recipes`(レシピ本体)
| カラム | 型/制約 |
|---|---|
| id | INTEGER PRIMARY KEY |
| name | TEXT NOT NULL |
| servings | INTEGER NOT NULL DEFAULT 1(このレシピの基準人数) |
| url | TEXT NOT NULL DEFAULT ''(参考URL) |
| image_ext | TEXT NOT NULL DEFAULT ''(空文字=画像未登録。拡張子のみDBに保持し実体はファイルシステム) |

### `recipe_ingredients`(レシピ材料)
| カラム | 型/制約 |
|---|---|
| id | INTEGER PRIMARY KEY |
| recipe_id | INTEGER NOT NULL REFERENCES recipes(id) |
| ingredient_id | INTEGER NOT NULL REFERENCES ingredients(id) |
| quantity | REAL NOT NULL |
| is_fixed_quantity | INTEGER NOT NULL DEFAULT 0(1=人数に比例させない) |

インデックス: `idx_recipe_ingredients_recipe_id`

### `recipe_seasonings`(レシピ調味料)
| カラム | 型/制約 |
|---|---|
| id | INTEGER PRIMARY KEY |
| recipe_id | INTEGER NOT NULL REFERENCES recipes(id) |
| seasoning_id | INTEGER NOT NULL REFERENCES seasonings(id) |
| quantity | REAL NOT NULL |
| is_fixed_quantity | INTEGER NOT NULL DEFAULT 0 |

インデックス: `idx_recipe_seasonings_recipe_id`

### `recipe_steps`(レシピ手順)
| カラム | 型/制約 |
|---|---|
| id | INTEGER PRIMARY KEY |
| recipe_id | INTEGER NOT NULL REFERENCES recipes(id) |
| step_no | INTEGER NOT NULL |
| text | TEXT NOT NULL |

インデックス: `idx_recipe_steps_recipe_id`

### `plans`(献立)
| カラム | 型/制約 |
|---|---|
| id | INTEGER PRIMARY KEY |
| date | TEXT(NULL可。NULLは「日付未定」の献立=未定エリア) |
| recipe_id | INTEGER REFERENCES recipes(id)(NULL可。NULLはレシピに依存しないメモ行=外食予定や作り置きなど) |
| servings | INTEGER NOT NULL DEFAULT 0 |
| meal_time | TEXT NOT NULL DEFAULT 'other'(morning/noon/night/other) |
| note | TEXT NOT NULL DEFAULT ''(メモ行のときは必須、レシピ紐づけ時は空) |

インデックス: `idx_plans_date`

### `plan_ingredient_overrides`(献立ごとの食材必要量オーバーライド)
| カラム | 型/制約 |
|---|---|
| plan_id | INTEGER NOT NULL REFERENCES plans(id) |
| ingredient_id | INTEGER NOT NULL REFERENCES ingredients(id) |
| quantity | REAL NOT NULL |
| PRIMARY KEY (plan_id, ingredient_id) |

### `plan_seasoning_overrides`(献立ごとの調味料必要量オーバーライド)
| カラム | 型/制約 |
|---|---|
| plan_id | INTEGER NOT NULL REFERENCES plans(id) |
| seasoning_id | INTEGER NOT NULL REFERENCES seasonings(id) |
| quantity | REAL NOT NULL |
| PRIMARY KEY (plan_id, seasoning_id) |

## 2. APIエンドポイント一覧

| メソッド パス | 概要 |
|---|---|
| GET /healthz | 死活監視用 |
| GET /api/ingredients | 食材マスタ一覧取得 |
| POST /api/ingredients | 食材マスタ新規作成(name, unit) |
| GET /api/ingredients/{id} | 食材マスタ1件取得 |
| PUT /api/ingredients/{id} | 食材マスタ更新 |
| DELETE /api/ingredients/{id} | 食材マスタ削除(レシピで使用中なら409) |
| GET /api/seasonings | 調味料マスタ一覧取得 |
| POST /api/seasonings | 調味料マスタ新規作成(name) |
| GET /api/seasonings/{id} | 調味料マスタ1件取得 |
| PUT /api/seasonings/{id} | 調味料マスタ更新 |
| DELETE /api/seasonings/{id} | 調味料マスタ削除(レシピで使用中なら409) |
| GET /api/stocks | 食材在庫一覧取得(食材名・単位込み) |
| PUT /api/stocks/{ingredientId} | 特定食材の在庫数量を更新(quantityは0以上) |
| GET /api/recipes | レシピ一覧取得(材料・調味料・手順込み) |
| POST /api/recipes | レシピ新規作成(材料/調味料/手順を同時登録) |
| GET /api/recipes/{id} | レシピ1件詳細取得 |
| PUT /api/recipes/{id} | レシピ更新(材料/調味料/手順はdelete-then-insertで全置換) |
| DELETE /api/recipes/{id} | レシピ削除(献立で使用中なら409。画像ファイルも削除) |
| GET /api/recipes/{id}/image | レシピ画像取得(未登録なら404) |
| POST /api/recipes/{id}/image | レシピ画像アップロード(最大8MB、jpeg/png/gif/webp判定) |
| DELETE /api/recipes/{id}/image | レシピ画像削除 |
| GET /api/plans | 献立一覧取得(from/toで期間指定、日付未定行は除外) |
| POST /api/plans | 献立新規作成(レシピ紐づけ or メモ行のいずれか) |
| GET /api/plans/summary | 指定期間の献立×在庫を集計(必要量・在庫からの残り) |
| GET /api/plans/unscheduled | 日付未定(未定エリア)の献立一覧取得 |
| GET /api/plans/{id} | 献立1件取得(食材・調味料オーバーライド込み) |
| PUT /api/plans/{id} | 献立更新(オーバーライドはdelete-then-insertで全置換) |
| DELETE /api/plans/{id} | 献立削除(オーバーライドも同一トランザクションで削除) |
| GET /api/shoppinglist | 指定期間の献立に対する不足食材リスト取得(在庫比較) |
| GET / | 静的ファイル配信(web/static、embedでバイナリに焼き込み) |

## 3. 画面一覧

すべての画面はヘッダー共通の「検討期間(from/to)」を持ち、`daterange.js` により localStorage `kondate-supporter:date-range` で画面遷移をまたいで値を保持・同期する(`daterangechange` イベントで各画面が再取得)。また共通の「材料集計」ダイアログ(`summary.js`)を全画面から開ける。

| 画面 | 内容 | 状態 |
|---|---|---|
| `index.html`(トップ) | サーバー死活確認(`/healthz`)を表示するだけの簡易ページ | 現行 |
| `masters.html`(マスタ管理) | 食材マスタ・調味料マスタをタブ切替で編集するダイアログ形式のCRUD画面 | 現行 |
| `stocks.html`(在庫) | 食材ごとの在庫数量を検索・編集。未登録の食材を検索した場合のみ「新規食材を追加」ボタンでその場で新規作成可能 | 現行 |
| `recipes.html`(レシピ) | レシピの一覧・検索・食材による絞り込み・詳細表示・作成/編集(材料・調味料・手順・画像) | 現行 |
| `plans.html`(献立) | 日付ごとの献立(レシピ+人数、またはメモ行)をタイムライン表示し追加/編集。編集ダイアログで必要食材・調味料量を自動計算し、オーバーライドも可能 | 現行 |
| `shoppinglist.html`(買い物リスト) | 指定期間の献立に対して在庫が不足している食材を一覧表示、コピー機能あり | 現行 |

## 4. 既知の設計判断・方針(逆行防止用)

- **`is_fixed_quantity`(人数に比例させない)フラグ**: `recipe_ingredients`/`recipe_seasonings` に持つ。API上は `fixedQuantity`。true なら `quantity` をそのまま使い、false なら `quantity * (servings / recipe.servings)` で倍率計算する。このロジックは `internal/service/shoppinglist.go` の `aggregate()`(バックエンド集計)と `web/static/js/plans.js` の `computeIngredientRequirement`/`computeSeasoningRequirement`(フロント編集プレビュー)の両方に独立して存在する。片方だけ直して同期を崩さないよう注意。

- **献立ごとのオーバーライド機構**: `plan_ingredient_overrides`/`plan_seasoning_overrides` は `(plan_id, ingredient_id/seasoning_id)` を主キーとする差分テーブル。更新はdelete-then-insertで全置換。`ShoppingListService.aggregate()` ではオーバーライドが存在する食材はfixedQuantity判定・倍率計算をスキップし、オーバーライド値を最優先で採用する。

- **調味料は`unit`カラムを持たない**: 数量は常にmL固定という前提。`internal/handler/recipe.go` の `recipeSeasoningResponse` は表示コードを食材側(`recipeIngredientResponse`)と共通化するため `Unit` フィールドを持つが値は常に `"mL"` 固定。在庫管理・買い物リスト算出の対象外。

- **単位換算ロジックを持たない**: `ingredients.unit` は自由入力文字列でマスタ化しない。在庫・レシピ材料・買い物リスト集計は同一ingredient_idの数量を同じunitとして単純加算するのみで、換算テーブルや変換関数は存在しない([docs/development.md](development.md)の制約に対応)。

- **献立の「日付未定」「レシピ非依存メモ行」という2つの独立した軸**: `plans.date` がNULLなら「未定エリア」、`plans.recipe_id` がNULLなら「外食予定や作り置きなど」のメモ行。買い物リスト集計では `recipe_id` がNULLの行は集計対象外。

- **RaspberryPi Zero(ARMv6・低メモリ)向けの制約**:
  - DBドライバは `modernc.org/sqlite`(CGO不要)。`mattn/go-sqlite3` はクロスコンパイルが煩雑なため不採用。
  - レシピ画像はSQLiteのBLOBではなくファイルシステムに保存し、ストリーム処理でメモリに全体を載せない(`internal/imagestore/imagestore.go`)。
  - 画像アップロードサイズは8MBに制限。

- **外部キー制約に頼らない事前バリデーション**: `validateIngredientsExist`/`validateSeasoningsExist`/`validateRecipeExists` は明示的なクエリで事前検出する方針。ただしレシピ削除時の「献立で使用中は削除不可」判定は外部キー制約違反の検出(`classifySQLiteError`)に依存しており、箇所によって方針が異なる点に注意。

- **マイグレーションは追記のみ**: 既存ファイルの内容変更は禁止。テーブル再構築が必要な場合(0008など)も、一時テーブルへの退避→復元手順を新規マイグレーションとして追加する。

- **レシピ更新/献立更新はdelete-then-insert方式**: 差分更新ではなく、材料/調味料/手順/オーバーライドを全削除してから再挿入する。個人利用規模では差分更新より単純さを優先する判断。
