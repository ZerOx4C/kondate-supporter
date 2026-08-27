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
| updated_at | TEXT NOT NULL DEFAULT (datetime('now'))(UTCの `YYYY-MM-DD HH:MM:SS` 形式) |

### `recipes`(レシピ本体)
| カラム | 型/制約 |
|---|---|
| id | INTEGER PRIMARY KEY |
| name | TEXT NOT NULL |
| servings | INTEGER NOT NULL DEFAULT 1(このレシピの基準人数) |
| url | TEXT NOT NULL DEFAULT ''(参考URL) |
| image_ext | TEXT NOT NULL DEFAULT ''(空文字=画像未登録。拡張子のみDBに保持し実体はファイルシステム) |

0001で作成した`description`カラムは0006で削除済み(手順は`recipe_steps`へ移行)。

### `recipe_ingredients`(レシピ材料)
| カラム | 型/制約 |
|---|---|
| id | INTEGER PRIMARY KEY |
| recipe_id | INTEGER NOT NULL REFERENCES recipes(id) |
| ingredient_id | INTEGER NOT NULL REFERENCES ingredients(id) |
| quantity | REAL NOT NULL |
| is_fixed_quantity | INTEGER NOT NULL DEFAULT 0(1=人数に比例させない) |
| note | TEXT NOT NULL DEFAULT ''(自由記述の補足。例:「小さめのもの」「あれば」) |

インデックス: `idx_recipe_ingredients_recipe_id`

### `recipe_seasonings`(レシピ調味料)
| カラム | 型/制約 |
|---|---|
| id | INTEGER PRIMARY KEY |
| recipe_id | INTEGER NOT NULL REFERENCES recipes(id) |
| seasoning_id | INTEGER NOT NULL REFERENCES seasonings(id) |
| quantity | REAL NOT NULL |
| is_fixed_quantity | INTEGER NOT NULL DEFAULT 0 |
| note | TEXT NOT NULL DEFAULT ''(自由記述の補足) |

インデックス: `idx_recipe_seasonings_recipe_id`

### `recipe_steps`(レシピ手順)
| カラム | 型/制約 |
|---|---|
| id | INTEGER PRIMARY KEY |
| recipe_id | INTEGER NOT NULL REFERENCES recipes(id) |
| step_no | INTEGER NOT NULL(1始まり。更新時に配列順で振り直す) |
| text | TEXT NOT NULL |

インデックス: `idx_recipe_steps_recipe_id`

### `plans`(献立)
| カラム | 型/制約 |
|---|---|
| id | INTEGER PRIMARY KEY |
| date | TEXT(NULL可。`plan_type = 'scheduled'` の行でのみ意味を持つ。それ以外の行では常にNULL) |
| plan_type | TEXT NOT NULL DEFAULT 'scheduled'(scheduled/daily/unscheduled。scheduled=日付指定、daily=検討期間内は毎日消費するとみなす献立=毎日エリア、unscheduled=日付未定=未定エリア) |
| recipe_id | INTEGER REFERENCES recipes(id)(NULL可。NULLはレシピに依存しないメモ行=外食予定や作り置きなど) |
| servings | INTEGER NOT NULL DEFAULT 0 |
| meal_time | TEXT NOT NULL DEFAULT 'other'(morning/noon/night/other) |
| note | TEXT NOT NULL DEFAULT ''(メモ行のときは必須、レシピ紐づけ時は空) |

インデックス: `idx_plans_date`

`plan_type` を正とし、`date IS NULL`/`date IS NOT NULL` によるSQL判定は使わず常に `plan_type` を比較する(0013で追加。`is_daily`のような単一目的フラグを種別ごとに増やし続けない設計判断)。

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

### `schema_migrations`(マイグレーション適用履歴)
| カラム | 型/制約 |
|---|---|
| name | TEXT PRIMARY KEY(マイグレーションファイル名) |
| applied_at | TEXT NOT NULL DEFAULT (datetime('now')) |

マイグレーションファイルではなく `internal/db/db.go` の `Migrate()` が `CREATE TABLE IF NOT EXISTS` で作成する。未記録のファイルをファイル名昇順に、1ファイル1トランザクションで適用する。

## 2. APIエンドポイント一覧

ルーティング登録は `internal/handler/router.go` の `NewRouter()` に集約(Go 1.22以降のメソッド付きパターンを使用)。

| メソッド パス | 概要 |
|---|---|
| GET /healthz | 死活監視用(`{"status":"ok"}`固定) |
| GET /api/ingredients | 食材マスタ一覧取得 |
| POST /api/ingredients | 食材マスタ新規作成(name, unit)。同一トランザクションで在庫行(quantity=0)も作成 |
| GET /api/ingredients/{id} | 食材マスタ1件取得 |
| PUT /api/ingredients/{id} | 食材マスタ更新 |
| DELETE /api/ingredients/{id} | 食材マスタ削除(在庫行も同時削除。レシピで使用中なら409) |
| GET /api/seasonings | 調味料マスタ一覧取得 |
| POST /api/seasonings | 調味料マスタ新規作成(name) |
| GET /api/seasonings/{id} | 調味料マスタ1件取得 |
| PUT /api/seasonings/{id} | 調味料マスタ更新 |
| DELETE /api/seasonings/{id} | 調味料マスタ削除(レシピで使用中なら409) |
| GET /api/stocks | 食材在庫一覧取得(食材名・単位・更新日時込み) |
| PUT /api/stocks/{ingredientId} | 特定食材の在庫数量を更新(quantityは0以上)。在庫行は食材作成時に生成済みのため、無ければ404 |
| GET /api/recipes | レシピ一覧取得(材料・調味料・手順込み) |
| POST /api/recipes | レシピ新規作成(材料/調味料/手順を同時登録) |
| GET /api/recipes/{id} | レシピ1件詳細取得 |
| PUT /api/recipes/{id} | レシピ更新(材料/調味料/手順はdelete-then-insertで全置換) |
| DELETE /api/recipes/{id} | レシピ削除(献立で使用中なら409。画像ファイルも削除) |
| GET /api/recipes/{id}/image | レシピ画像取得(未登録なら404) |
| POST /api/recipes/{id}/image | レシピ画像アップロード(multipart の `image` フィールド、最大8MB、jpeg/png/gif/webp判定。成功時204) |
| DELETE /api/recipes/{id}/image | レシピ画像削除(成功時204) |
| GET /api/plans | 献立一覧取得(from/toで期間指定、どちらも省略可。`plan_type = 'scheduled'` の行のみ対象。日付→朝/昼/夜/その他→idの順にソート) |
| POST /api/plans | 献立新規作成(レシピ紐づけ or メモ行のいずれか)。`type`(scheduled/daily/unscheduled)を指定、scheduled以外はdateを無視し常にNULL保存。オーバーライドはバリデーションのみで保存されない |
| GET /api/plans/summary | 指定期間の献立に登場する食材と在庫が0より多い食材の和集合について、必要量・在庫からの残り(不足時はマイナス)を返す。毎日献立(`plan_type = 'daily'`)はfrom/toが両方指定された場合のみ期間日数を乗数として加算する |
| GET /api/plans/unscheduled | 日付未定(未定エリア、`plan_type = 'unscheduled'`)の献立一覧取得(検討期間によらず全件) |
| GET /api/plans/daily | 毎日(毎日エリア、`plan_type = 'daily'`)の献立一覧取得(検討期間によらず全件) |
| GET /api/plans/{id} | 献立1件取得(食材・調味料オーバーライド込み) |
| PUT /api/plans/{id} | 献立更新(オーバーライドはdelete-then-insertで全置換) |
| DELETE /api/plans/{id} | 献立削除(オーバーライドも同一トランザクションで削除) |
| GET /api/shoppinglist | 指定期間の献立に対する不足食材リスト取得(在庫比較。不足が0以下の食材は返さない)。毎日献立はfrom/toが両方指定された場合のみ期間日数を乗数として加算する |
| GET / | ルートパスのみ `/plans.html` へリダイレクト(302)。それ以外は静的ファイル配信(web/static、embedでバイナリに焼き込み。`DEV_MODE=1` のときのみ `os.DirFS("web/static")` から配信) |

エラー応答は全て `{"error": "メッセージ"}` 形式(`internal/handler/respond.go`)。

## 3. 画面一覧

すべての画面はヘッダー共通の「検討期間(開始日+日数)」を持ち、`daterange.js` により localStorage `kondate-supporter:date-range` で画面遷移をまたいで値を保持・同期する(`daterangechange` イベントで各画面が再取得)。入力は開始日(`range-from`)と日数(`range-days`、開始日を含めてN日間)で、`daterange.js` の `getDateRange()` が開始日+日数から `{from, to}` 形式(to = from + (日数-1))に変換し、各画面・APIへ渡す。前後の期間へ日数分だけ開始日をずらす矢印ボタン(`range-shift-prev`/`range-shift-next`)も共通ヘッダーに持つ。また共通の「材料集計」ダイアログ(`summary.js`、`GET /api/plans/summary` を表示)を全画面から開ける。

| 画面 | 内容 | 状態 |
|---|---|---|
| `stocks.html`(在庫) | 食材ごとの在庫数量を検索・編集。未検索時は数量0の在庫を非表示にし、検索時のみ数量0を末尾に含めて表示する。検索中のみ「新規食材を追加」ボタンが現れ、検索語を初期値にその場で食材を新規作成できる。更新日時は相対表記(さっき/N時間前/N日前/かなり前) | 現行 |
| `recipes.html`(レシピ) | レシピのカード一覧・検索・食材による絞り込み・詳細表示・作成/編集(材料・調味料・手順・画像)。編集時の材料・調味料選択は`<select>`ではなく検索パネル形式のポップオーバーダイアログ(単一選択、その場での新規食材/調味料作成も可能)。詳細から「未定に追加」で日付未定の献立を1件作成できる | 現行 |
| `plans.html`(献立) | 日付ごとの献立(レシピ+人数、またはメモ行)を検討期間分のタイムラインと未定エリア・毎日エリアに表示し追加/編集。未定エリアの次に毎日エリア(検討期間内は毎日消費するとみなす献立)を表示し、両エリアとも検討期間によらず全件表示・日付欄なしで扱われる。パネル本体をクリックすると`#plan-dialog`が表示モードで開く(`recipes.html`の`#recipe-dialog`と同様、1つの`<dialog>`が表示/編集モードを切り替えるhead/body/foot構成)。表示モードは画像・参考URL・食材/調味料リスト(その献立自身の人数・個別オーバーライドを反映して算出)・手順、またはメモ内容を表示し、「編集」ボタンで同一ダイアログが編集モードに切り替わる。編集モードの日付`<select>`は「未定」「毎日」+検討期間内の日付から選び、選択値がそのまま献立の`date`/`type`の組に対応する。パネルのハンドルをPointerEventでドラッグして別日付・未定エリア・毎日エリアへ移動できる(ハンドル・編集/削除ボタンのクリックはパネル本体のクリックへ伝播させない) | 現行 |
| `shoppinglist.html`(買い物リスト) | 指定期間の献立に対して在庫が不足している食材を一覧表示、コピー機能あり | 現行 |
| `admin.html`(管理) | 「監視」「食材マスタ」「調味料マスタ」の3タブ切替画面。監視タブはサーバー死活確認(`/healthz`)を表示、各マスタタブは食材マスタ・調味料マスタをダイアログ形式で編集するCRUD画面(`materialCreateDialog.js`ではなく画面固有の`master-dialog`を使う) | 現行 |

### 共通フロントエンド部品(`web/static/js/`)

| ファイル | 役割 |
|---|---|
| `api.js` | `fetch`のラッパー`apiRequest()`と、全APIエンドポイントに対応する関数群 |
| `daterange.js` | 共通ヘッダーの検討期間(開始日+日数)の保持・同期・前後シフト |
| `dialog.js` | `<dialog>`共通処理。背景クリック判定`isDialogBackdropClick()`、開いている間の`body`スクロールロック(MutationObserverで`open`属性を監視)、ネイティブ`confirm()`を置き換える`confirmDialog()` |
| `summary.js` | 全画面共通の「材料集計」ダイアログ |
| `materialCreateDialog.js` | 食材/調味料の新規作成ダイアログ。`recipes.js`(材料選択パネル)と`stocks.js`(在庫画面)から共用 |
| `toast.js` | 短時間で自動的に消える簡易トースト通知`showToast()` |

### UIデザインの共通化状況

- `css/style.css` の`:root`にデザイントークンを定義(`--color-*`はダークモード対応の`light-dark()`、`--radius-*`、`--shadow-*`、`--space-*`、`--font-size-*`、食事区分ごとの`--color-meal-*`)。
- ダイアログ・ボタン・入力欄・テーブルは共通クラスに集約(`.app-dialog`、`.dialog-actions`、`.btn-accent`、`.btn-danger-outline`、`.text-input`、`.search-field`、`.table-plain`、`.body-scroll-locked`、`.toast`)。画面ごとのCSS重複定義は廃止済み。
- 削除確認はネイティブ`confirm()`を使わず`confirmDialog()`(`dialog.js`が動的生成する使い捨て`<dialog>`)に統一。献立・レシピ・マスタ管理の削除がこれを利用する。
- アイコンは`web/static/vendor/tabler-icons`をバイナリに同梱して使用(`<i class="ti ti-*">`)。外部CDNには依存しない。

## 4. 既知の設計判断・方針(逆行防止用)

- **`is_fixed_quantity`(人数に比例させない)フラグ**: `recipe_ingredients`/`recipe_seasonings` に持つ。API上は `fixedQuantity`。true なら `quantity` をそのまま使い、false なら `quantity * (servings / recipe.servings)` で倍率計算する。このロジックは `internal/service/shoppinglist.go` の `aggregate()`(バックエンド集計)と `web/static/js/plans.js` の `computeIngredientRequirement`/`computeSeasoningRequirement`(フロント編集プレビュー)の両方に独立して存在する。片方だけ直して同期を崩さないよう注意。

- **献立ごとのオーバーライド機構**: `plan_ingredient_overrides`/`plan_seasoning_overrides` は `(plan_id, ingredient_id/seasoning_id)` を主キーとする差分テーブル。保存は `PUT /api/plans/{id}` のみが行い、delete-then-insertで全置換する(`POST /api/plans` はリクエストを検証するだけで保存しない。献立追加直後にオーバーライドを持つことはない前提)。`ShoppingListService.aggregate()` では倍率計算した値をオーバーライド値で上書きするため、オーバーライドが最優先で採用される。

- **調味料オーバーライドは集計に反映されない**: `aggregate()` が参照するのは `plan_ingredient_overrides` のみ。調味料は在庫管理・買い物リスト算出の対象外であり、`plan_seasoning_overrides` は献立編集画面での表示・保持用に留まる。

- **調味料は`unit`カラムを持たない**: 数量は常にmL固定という前提。`internal/handler/recipe.go` の `recipeSeasoningResponse` は表示コードを食材側(`recipeIngredientResponse`)と共通化するため `Unit` フィールドを持つが値は常に `"mL"` 固定。

- **単位換算ロジックを持たない**: `ingredients.unit` は自由入力文字列でマスタ化しない。在庫・レシピ材料・買い物リスト集計は同一ingredient_idの数量を同じunitとして単純加算するのみで、換算テーブルや変換関数は存在しない([docs/development.md](development.md)の制約に対応)。

- **献立の「種別(`plan_type`)」「レシピ非依存メモ行」という2つの独立した軸**: `plans.plan_type` が `scheduled`/`daily`/`unscheduled` のいずれか(scheduled=日付指定、daily=毎日エリア、unscheduled=未定エリア)、`plans.recipe_id` がNULLなら「外食予定や作り置きなど」のメモ行。買い物リスト集計では `recipe_id` がNULLの行は集計対象外。`PlanRepository.List()` は `plan_type = 'scheduled'` を常に条件に含め、未定エリアは `ListUnscheduled()`(`plan_type = 'unscheduled'`)、毎日エリアは `ListDaily()`(`plan_type = 'daily'`)がそれぞれ期間指定なしで返す。

- **`plan_type`列アプローチ(0013)**: 献立の種別追加(未定に続く「毎日」エリア)にあたり、`is_daily` のような単一目的のbool列を種別ごとに増やし続けるのではなく、`plan_type` という文字列enum列(`scheduled`/`daily`/`unscheduled`)で表現する方針を採用した。`plan_type` を正とし、`date` 列は `plan_type = 'scheduled'` の行でのみ意味を持つ(それ以外は常にNULL)。この不変条件はhandler層(`planRequest.validate()`、type≠scheduledならdateを無視)とrepository層(`Create`/`Update`、type≠scheduledならdate引数を無視して常にNULLを書き込む)の両方で防御的に保証している。

- **毎日献立(`plan_type = 'daily'`)の買い物リスト・材料集計への寄与**: `ShoppingListService.aggregate()` は通常献立(乗数1)と毎日献立(乗数=検討期間の日数)を同じ`addPlanRequirement()`ロジックで集計する。毎日献立は検討期間の `from`/`to` が両方とも指定されている場合のみ「期間の日数」を乗数として加算し、どちらか一方でも省略された場合は日数を決定できないため寄与を0として扱う(毎日献立の集計自体をスキップする)。食材のオーバーライド値は「1日分の必要量」という前提のため、オーバーライドされている場合も同様に乗数を掛けてから加算する。

- **基準人数が不正なレシピは集計をスキップ**: `aggregate()` は `recipe.servings <= 0` の献立を倍率計算不能としてスキップする(0除算を避けるための防御)。

- **`stocks`は`ingredients`と1:1で常に存在する**: 食材作成時に同一トランザクションで `quantity=0` の在庫行を作成し、食材削除時に在庫行も削除する。そのため在庫更新APIはUPSERTではなくUPDATEのみで、行が無ければ404を返す。

- **RaspberryPi Zero(ARMv6・低メモリ)向けの制約**:
  - DBドライバは `modernc.org/sqlite`(CGO不要)。`mattn/go-sqlite3` はクロスコンパイルが煩雑なため不採用。
  - SQLiteのPRAGMAはDSNに埋め込む(`_pragma=busy_timeout(5000)&_pragma=foreign_keys(1)`)。プールが新規接続を作るたびに適用させるため、`conn.Exec()`による事後設定は使わない。
  - 書き込み競合による `SQLITE_BUSY` を避けるため `SetMaxOpenConns(1)` で単一接続に固定する。個人利用・単一プロセス常時稼働が前提。
  - レシピ画像はSQLiteのBLOBではなくファイルシステムに `{レシピID}.{拡張子}` として保存し、先頭512バイトで形式判定してから残りをストリームコピーする(`internal/imagestore/imagestore.go`)。
  - 画像アップロードサイズは8MBに制限(`http.MaxBytesReader`)。

- **外部キー制約に頼らない事前バリデーション**: `validateIngredientsExist`/`validateSeasoningsExist`/`validateRecipeExists` は明示的なクエリで事前検出する方針。ただし削除時の「使用中は削除不可」判定(レシピ←献立、食材←レシピ材料、調味料←レシピ調味料)は外部キー制約違反の検出(`classifySQLiteError` → `ErrInUse`)に依存しており、箇所によって方針が異なる点に注意。UNIQUE制約違反も同関数で `ErrDuplicateName` に変換する。

- **マイグレーションは追記のみ**: 既存ファイルの内容変更は禁止。テーブル再構築が必要な場合(0008など)も、一時テーブルへの退避→復元手順を新規マイグレーションとして追加する。

- **レシピ更新/献立更新はdelete-then-insert方式**: 差分更新ではなく、材料/調味料/手順/オーバーライドを全削除してから再挿入する。個人利用規模では差分更新より単純さを優先する判断。

- **設定は環境変数のみ**: `internal/config/config.go` が `KONDATE_ADDR`(既定`:8080`)、`KONDATE_DB_PATH`(既定`data/kondate.db`)、`KONDATE_IMAGE_DIR`(既定`data/recipe-images`)、`DEV_MODE`(`1`で静的ファイルをembedではなくディレクトリから配信)を読む。設定ファイルは持たない。
