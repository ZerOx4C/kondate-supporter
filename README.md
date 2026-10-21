# kondate-supporter

家庭内LAN限定・個人利用の献立管理ツール。RaspberryPi Zeroにデプロイして常時稼働させる想定。

以前の実装を `kondate-supporter-old` として退避し、ROADMAPの項目を1つずつ完成させる方針で再構築中([CLAUDE.md](CLAUDE.md)参照)。

## 現在の機能(v1: レシピ登録)

- レシピ(タイトル+自由テキスト)の登録・一覧・詳細表示・編集・削除

今後の改修予定は [ROADMAP.md](ROADMAP.md) を参照。

## 必要環境

- Go 1.26 以上
- make(Git Bash または WSL から実行)

## 同梱ライブラリ

CDNは使わず、配布ファイルを無編集のまま `web/static/vendor/` に置いてバイナリに焼き込む。

| ライブラリ | 版 | ライセンス | 置き場所 |
|---|---|---|---|
| Tabler Icons Webfont(`@tabler/icons-webfont`。outline) | 3.49.0 | MIT | `web/static/vendor/tabler-icons/` |

更新するときは、パッケージの `dist/tabler-icons.min.css`・`dist/fonts/tabler-icons.woff2`・`LICENSE` を差し替え、上の版数を書き換える。

## セットアップ・開発時の起動

引数なしの `make`(または `make help`)でターゲットの一覧が出る。開発起動は `make run` を明示する。

```bash
make run
```

`http://localhost:8080/` を開く。DBは `data/kondate.db` に自動で作られる。HTML/JSは保存するだけで反映され、Goのコードを変えたときは再起動する。

環境変数で設定を変えられる。

| 変数 | 既定値 | 内容 |
|---|---|---|
| `KONDATE_ADDR` | `:8080` | 待ち受けアドレス |
| `KONDATE_DB_PATH` | `data/kondate.db` | SQLiteファイルのパス |
| `DEV_MODE` | (未設定) | `1` のとき画面ファイルをディスクから配信する。`make run` では自動で `1` |

## Windowsでの稼働(RaspberryPiを用意するまでのつなぎ)

1. `make build-win` を実行すると `bin/kondate-supporter-windows.exe` ができる。
2. 任意のフォルダへコピーして実行する。画面はexeに含まれているので、コピーするのはexe1つだけでよい。
3. 初回起動時のWindowsファイアウォールの確認で「プライベートネットワーク」を許可すると、LAN内のスマホ・タブレットから `http://<PCのIPアドレス>:8080/` で使える。
4. DBは実行時のカレントディレクトリからの `data\kondate.db` に作られる。開発用DBと分けたいときや場所を固定したいときは `KONDATE_DB_PATH` を指定する。
5. 開発用の `make run` も既定で `:8080` を使う。同時に動かすときは、どちらかの `KONDATE_ADDR` を変える。

## RaspberryPi Zeroへのデプロイ

1. `make build-rpi` を実行すると `bin/kondate-supporter-linux-armv6` ができる。
2. scpなどでPiへコピーし、`chmod +x` してから実行する。
3. DBの置き場所はWindowsの場合と同じ(カレントディレクトリからの `data/kondate.db`。固定したいときは `KONDATE_DB_PATH` に絶対パスを指定)。
4. 常駐化(systemdなど)は各自で設定する。
