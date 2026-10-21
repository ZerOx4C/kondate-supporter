# 設計概要

コード構成・DB・API・画面の現状と、逆行を防ぐための設計判断をまとめる。
1〜4節は実装時に実態へ合わせて更新し、5節には `architect` の計画に含まれる設計判断を転記する。

> v1実装着手前の計画段階の内容を含む。実装で変わった箇所は実態に合わせて書き換えること。

## 1. コード構成

```
cmd/server/main.go       # エントリポイント(DBオープン→マイグレーション適用→ルーティング登録→ListenAndServe)
internal/config/         # 設定(待ち受けアドレス・DBパス・開発モードを環境変数で受け取る)
internal/db/             # sql.DBオープン、マイグレーション実行
internal/db/migrations/  # SQLマイグレーションファイル(embedでバイナリに焼き込み)
internal/model/          # ドメイン構造体
internal/repository/     # DBアクセス層(SQL実行のみ)
internal/service/        # ビジネスロジック層
internal/handler/        # HTTPハンドラ層
web/embed.go             # web/static をembedで焼き込み、fs.FSとして提供
web/static/              # フロントエンド(画面ごとのHTMLと同名JS。recipes.html / recipes.js。embedでバイナリに焼き込み)
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

`internal/db/db.go` の `Migrate()` が `main.go` から起動時に呼ばれ、 `internal/db/migrations/*.sql` を未適用のものだけファイル名昇順・1ファイル1トランザクションで適用する。

## 3. APIエンドポイント

ルーティングは `internal/handler/router.go` の `NewRouter()` に集約する(Go 1.22以降のメソッド付きパターン)。

| メソッド パス | 概要 |
|---|---|
| GET /healthz | 死活監視用(`{"status":"ok"}`固定) |
| GET /api/recipes | レシピ一覧取得。200で配列(id昇順、bodyを含む。0件は `[]`) |
| POST /api/recipes | レシピ新規作成。リクエスト `{"name","body"}`、201で作成したレシピ |
| GET /api/recipes/{id} | レシピ1件取得。200 |
| PUT /api/recipes/{id} | レシピ更新(全体置換)。リクエストは作成と同じ、200で更新後のレシピ |
| DELETE /api/recipes/{id} | レシピ削除。204(ボディなし) |
| GET / | ルートパスのみ `/recipes.html` へリダイレクト(302)。それ以外は静的ファイル配信(embed。`DEV_MODE=1` のときのみ `os.DirFS("web/static")` から配信) |

エラー応答は `internal/handler/respond.go` の `writeError` で `{"error": "メッセージ"}` として返す。

| ステータス | 条件 | メッセージ |
|---|---|---|
| 400 | `{id}` が数値でない・1未満 | IDが不正です |
| 400 | リクエストJSONが不正 | リクエストの形式が不正です |
| 400 | `name` が空白除去後に空 | 名前を入力してください |
| 404 | 対象IDのレシピが無い | レシピが見つかりません |
| 500 | 上記以外(詳細はログのみ) | サーバー内部でエラーが発生しました |

## 4. 画面

| 画面 | 内容 | 状態 |
|---|---|---|
| `recipes.html`(レシピ) | 名前のみの縦積みカードリスト・新規作成・詳細(閲覧→「編集」で入力フォームへ切替)・削除。詳細/編集は `<dialog>`(name入力欄 + bodyのtextareaのみ)、削除・破棄の確認は専用の確認 `<dialog>` | 実装済み。ロジックは `recipes.js` |

## 5. 設計判断(逆行防止用)

- **モジュール名は `kondate-supporter`**: 外部へ公開せず `go install` もしないため、GitHubのパスにはしない。importを短く保ち、旧実装を参照するときの読み替えを無くす。
- **ディレクトリは使う項目で作る**: `.gitkeep` などの目印ファイルは置かない。`internal/db`・`model`・`repository`・`service` は、そのコードを初めて書くROADMAP項目で作る。ヘルパー関数や設定項目も、使う項目で追加する。

- **SQLiteの接続は1本に制限する**: `SetMaxOpenConns(1)` で書き込みを直列化し `SQLITE_BUSY` を避ける。単一プロセス・個人利用でRaspberryPi Zeroにも合う。PRAGMAは新規接続にも確実に効くようDSNの `_pragma` で指定する(接続後の `Exec` ではプールが作る新規接続に反映されないことがある)。
- **マイグレーションは `internal/db` で直接embedする**: 読み込み側は `Migrate()` だけなので専用パッケージは分けない。
- **serviceはrepositoryの具象型に依存する**: テストの差し替えなどインターフェースが必要になる場面がまだROADMAPに無いため、`*repository.RecipeRepository` を直接持つ。
- **handlerはrepositoryをimportしない**: 依存を `handler → service → repository` に保つ。「見つからない」はrepositoryの `ErrNotFound` をserviceが自分の `ErrNotFound` に置き換えて伝える。ユーザー向けメッセージはserviceのエラー値に持たせ、handlerはHTTPステータスへの振り分けだけを行う。
- **名前の入力チェックはserviceで行う**: 「前後の空白を除いて空なら不可」は業務ルールなのでserviceに置き、保存するのも空白を除いた後の値。`body` は自由テキストとして書かれたまま保存する。
- **PUTは全体置換**: 項目が name と body だけなので部分更新(PATCH)は作らない。
- **一覧はid昇順(登録順)でbodyも含めて返す**: SQLiteの文字列比較では日本語の名前がよみ順に並ばないため名前順は採らない。家庭内の規模なので一覧と詳細でレスポンスの形を分けない。
- **ID存在確認は `RowsAffected` で行う**: UPDATE・DELETEの前にSELECTせず、影響行数0なら404とする。
- **画面は1つのHTMLと同名のJSに分ける**: 画面固有CSSはHTMLの `<style>` に置く。画面が1つの間は共通CSS/JSを作らず、2つ目の画面を作る項目で切り出す。
- **詳細は一覧のデータで表示する**: 一覧APIがbodyも返すので、カードを開くときに `GET /api/recipes/{id}` は呼ばない。保存・削除の後は一覧を丸ごと読み直す。
- **詳細はまず閲覧表示にし、「編集」で入力フォームに切り替える**: 調理中の誤編集やキーボードの出現を防ぐため。本文は `textContent` と `white-space: pre-wrap` で書いたとおりの改行で表示する。
- **確認は画面内の確認 `<dialog>` を文言違いで使い回す**: 削除確認と未保存の破棄確認で共用し、`confirm()` は使わない(見た目を画面とそろえるため)。
- **未保存の変更があれば、どの閉じ方でも確認する**: キャンセルボタン・Esc(`cancel` イベントを止める)・外側タップを同じ「閉じる要求」に通す。変更の有無は編集開始時の値との比較。外側タップは `pointerdown` と `click` の対象がどちらも `<dialog>` 自身のときだけとみなし、テキスト選択のドラッグで閉じないようにする。
- **入力チェックはサーバーだけで行う**: クライアントに二重実装せず、APIの `error` メッセージをそのまま表示する。
- **レシピ本文は構造化しない**: 材料・調味料・手順は `body` 1カラムの自由テキストに持たせる。名称+数量+単位での構造化やLLMによる抽出はROADMAPに項目が無い限り着手しない。
- **在庫・献立・買い物リストは現時点のスコープ外**: 関連するテーブル・APIはROADMAPに項目が追加されるまで作らない。
