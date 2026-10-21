# 設計概要

コード構成・DB・API・画面の現状と、逆行を防ぐための設計判断をまとめる。
1〜4節は実装時に実態へ合わせて更新し、5節には `architect` の計画に含まれる設計判断を転記する。

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
web/static/vendor/       # 同梱した外部ライブラリ(配布ファイルのまま。tabler-icons/ にoutlineのCSS・woff2・LICENSE。版数はREADME)
Makefile                 # make / make help(ターゲット一覧)/ make run(開発起動)/ make build-rpi(RaspberryPi Zero向けビルド)/ make build-win(Windows向けビルド)
bin/                     # ビルド成果物の出力先(Git管理外)
scripts/                 # preview用サーバーの起動スクリプト(preview-server.ps1)
data/                    # SQLiteファイルの実行時生成先(Git管理外)
```

## 2. DBスキーマ

### `recipes`(レシピ)
| カラム | 型/制約 |
|---|---|
| id | INTEGER PRIMARY KEY |
| name | TEXT NOT NULL(タイトル) |
| body | TEXT NOT NULL DEFAULT ''(材料・調味料・手順を含む自由テキスト) |
| cooked_count | INTEGER NOT NULL DEFAULT 0(作った回数) |

### `schema_migrations`(マイグレーション適用履歴)
| カラム | 型/制約 |
|---|---|
| name | TEXT PRIMARY KEY(マイグレーションファイル名) |
| applied_at | TEXT NOT NULL DEFAULT (datetime('now')) |

`internal/db/db.go` の `Migrate()` が `main.go` から起動時に呼ばれ、 `internal/db/migrations/*.sql` を未適用のものだけファイル名昇順・1ファイル1トランザクションで適用する。

## 3. APIエンドポイント

ルーティングは `internal/handler/router.go` の `NewRouter()` に集約する(Go 1.22以降のメソッド付きパターン)。レシピのJSONは `{"id","name","body","cooked_count"}`。PUTは `cooked_count` を受け付けず値も変えない。

| メソッド パス | 概要 |
|---|---|
| GET /healthz | 死活監視用(`{"status":"ok"}`固定) |
| GET /api/recipes | レシピ一覧取得。200で配列(id昇順、bodyを含む。0件は `[]`) |
| POST /api/recipes | レシピ新規作成。リクエスト `{"name","body"}`、201で作成したレシピ |
| GET /api/recipes/{id} | レシピ1件取得。200 |
| PUT /api/recipes/{id} | レシピ更新(全体置換)。リクエストは作成と同じ、200で更新後のレシピ |
| DELETE /api/recipes/{id} | レシピ削除。204(ボディなし) |
| POST /api/recipes/{id}/cooked | 作った回数を1増やす。200で更新後のレシピ |
| DELETE /api/recipes/{id}/cooked | 作った回数を1減らす(0未満にはしない)。200で更新後のレシピ |
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
| `recipes.html`(レシピ) | 名前を左、作った回数(ti-chef-hatのアイコンと数字。0回はアイコンのみ)を右端に出す縦積みカードリスト・新規作成・詳細(閲覧→「編集」で入力フォームへ切替)・削除・閲覧表示の「作った」ボタン(押すたびに加算と減算を切り替えるトグル)。詳細/編集は `<dialog>`(name入力欄 + bodyのtextareaのみ)、削除・破棄の確認は専用の確認 `<dialog>`。ボタンはTabler Iconsのアイコン付き(新規作成・編集・閉じるはアイコンのみ) | 実装済み。ロジックは `recipes.js` |

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
- **ID存在確認は事前にSELECTしない**: DELETEは `RowsAffected` が0なら404とする。UPDATEは `RETURNING` で更新後の行をそのまま応答に使い、行が無ければ404とする(PUTの応答でも、受け付けない `cooked_count` の実際の値を返せる)。
- **作った回数は専用エンドポイントでだけ変える**: PUTの全体置換に回数を含めると、編集中に別の端末で「作った」を押した場合、保存で回数が古い値に戻ってしまう。そのためPUTでは受け付けず、加算・減算はSQLの `cooked_count + 1` で行う(読んでから書く手順にしない)。
- **減算は0で止め、エラーにしない**: `MAX(cooked_count - 1, 0)` で下限をSQLに任せる。0回で取り消しても200で0回のまま返し、画面側で回数を確かめなくて済むようにする。
- **「作った」は押すたびに切り替わる1つのボタンにし、取り消し専用のボタンは置かない**: SNSの「いいね」と同じく、押すと回数が増えて押した状態になり、もう一度押すと減って元に戻る。続けて押しても回数が重ねて増えず、取り消すと必ず開いたときの回数に戻る。
- **「作った」の押した状態は画面のJSだけで持ち、ダイアログを開くたびに押す前に戻す**: 記録したいのは回数で、誰がいつ押したかではないのでDBには持たない。編集に切り替えても閉じるまでは保つので、閲覧表示に戻ったあとも取り消せる。
- **作った回数はアイコンと数字だけで表し、0回は数字を出さない**: 一覧で作ったことのあるレシピが見分けやすく、文言を切り替える処理も要らない。一覧カードでは右端にそろえて見比べやすくする。
- **押した状態は背景と枠の色で表し、`aria-pressed` で伝える**: 同梱しているのはoutline版のアイコンだけで、塗りつぶしに切り替えられないため。CSSは `aria-pressed` の値を見て色を付け、状態の値を1つにまとめる。
- **画面は1つのHTMLと同名のJSに分ける**: 画面固有CSSはHTMLの `<style>` に置く。画面が1つの間は共通CSS/JSを作らず、2つ目の画面を作る項目で切り出す。
- **詳細は一覧のデータで表示する**: 一覧APIがbodyも返すので、カードを開くときに `GET /api/recipes/{id}` は呼ばない。保存・削除の後は一覧を丸ごと読み直す。
- **詳細はまず閲覧表示にし、「編集」で入力フォームに切り替える**: 調理中の誤編集やキーボードの出現を防ぐため。本文は `textContent` と `white-space: pre-wrap` で書いたとおりの改行で表示する。
- **確認は画面内の確認 `<dialog>` を文言違いで使い回す**: 削除確認と未保存の破棄確認で共用し、`confirm()` は使わない(見た目を画面とそろえるため)。
- **未保存の変更があれば、どの閉じ方でも確認する**: キャンセルボタン・Esc(`cancel` イベントを止める)・外側タップを同じ「閉じる要求」に通す。変更の有無は編集開始時の値との比較。外側タップは `pointerdown` と `click` の対象がどちらも `<dialog>` 自身のときだけとみなし、テキスト選択のドラッグで閉じないようにする。
- **入力チェックはサーバーだけで行う**: クライアントに二重実装せず、APIの `error` メッセージをそのまま表示する。
- **レシピ本文は構造化しない**: 材料・調味料・手順は `body` 1カラムの自由テキストに持たせる。名称+数量+単位での構造化やLLMによる抽出はROADMAPに項目が無い限り着手しない。
- **Makefileはsh前提で書く**: 開発PCではGit Bash/WSLからmakeを実行する。cmd.exeでの動作は考えず、環境変数は `VAR=値 コマンド` の形で渡す。
- **引数なしの `make` はhelpを表示する**: `.DEFAULT_GOAL := help` にして、`make` だけを打ったときに開発サーバーが起動しないようにする。どのターゲットがあるかもその場で分かる。
- **helpの一覧はターゲット行末尾の `## 説明` から自動で作る**: `awk` で `$(MAKEFILE_LIST)` を読んで抜き出す。ターゲットを増やすときはその行に `## 説明` を書くだけでよく、help側を書き換えない。詳しい理由や注意は、これまでどおりターゲットの上の行に `#` コメントで書く。
- **`make run` は固定パスへビルドしてから実行する**: `go run` は実行のたびに一時パスへバイナリを作るため、Windowsファイアウォールの許可を何度も求められ、許可ルールも増え続ける。
- **`make run` は `DEV_MODE=1` で起動する**: 画面ファイルをディスクから配信し、HTML/JSの修正をビルドし直さずに確認できるようにする。
- **開発用・preview用・Windows常用のバイナリ名を分ける**: Windowsでは実行中のexeを上書きできないため。つなぎ運用のサーバーを動かしたまま開発用やpreview用をビルドしても失敗しないようにする。
- **`make build-win` はRaspberryPiを用意するまでのつなぎ**: 開発用の `make run` とは別に、embed配信・シンボル除去済みの配置用exeを作る。GOARCHは指定せず、ビルドしたマシンに合わせる。
- **RaspberryPi Zero向けは `GOARM=6`・`CGO_ENABLED=0`・`-trimpath -ldflags="-s -w"` でビルドする**: Pi Zero/Zero WはARMv6のため。SQLiteドライバがCGO不要なので静的バイナリ1つで配置でき、シンボルを除いて転送・保存のサイズを抑える。
- **外部ライブラリはCDNを使わず `web/static/vendor/<名前>/` に無編集で同梱する**: LAN内でインターネットにつながらなくても画面が崩れないようにするため。embedでバイナリに入るので配置はファイル1つのまま。版数はREADMEに記録する。
- **Tabler Iconsはoutline(3.49.0では無印の `tabler-icons.min.css` / `fonts/tabler-icons.woff2`)のCSSとwoff2だけを置く**: filled・200/300版、woff・ttfは使わない。CSSの `src` は先頭がwoff2で、対応ブラウザは後ろの形式を取りに行かないため、CSS内の残りの参照は書き換えずに放置する。
- **アイコンだけのボタンには `aria-label` と `title` にもとの文言を入れる**: 読み上げで名前が分かり、PCではカーソルを合わせると意味が出るようにするため。アイコン自体は `aria-hidden="true"`。`icon-only` クラスで44px四方以上にしてタッチで押しやすくする。
- **ボタンは `inline-flex` でアイコンと文字を並べる**: 縦位置と間隔を `align-items` と `gap` でそろえる。一覧カードのボタンだけは左寄せに戻す。
- **確認ダイアログのボタンは文字だけにする**: OKボタンは「削除する」「破棄する」と文言を差し替えて使い回すため、アイコンを固定できない。
- **空状態の案内には実物のアイコンを文中に出す**: 「新規作成」がアイコンだけのボタンになったため、文字で名前を書いても画面上で見つけられない。ボタンと同じ ti-plus を文中に入れて対応を分かりやすくする。
- **静的ファイルにキャッシュ用の仕組みは作らない**: 画面が1枚でLAN内の通信なので、ROADMAPに項目が無い限り着手しない。
- **デプロイは手作業とし、仕組みを作らない**: 転送や常駐化(systemd・Windowsのサービス化)の自動化は個人利用では必要性が薄いため、READMEの手順だけで運用する。
- **在庫・献立・買い物リストは現時点のスコープ外**: 関連するテーブル・APIはROADMAPに項目が追加されるまで作らない。
