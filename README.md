# kondate-supporter

家庭内LAN限定・個人利用の献立管理ツール。RaspberryPi Zeroにデプロイして常時稼働させる想定。

## 機能

- 冷蔵庫の在庫記録
- レシピ登録
- 献立(日付・レシピ・人数)登録
- 買い物リスト生成(献立に対する在庫不足分の算出)

## 必要環境

- Go 1.26 以上

## セットアップ

```sh
go mod tidy
```

## 開発時の起動

```sh
make run
```

デフォルトでは `data/kondate.db` にSQLiteファイルを作成し、`:8080` で待ち受ける。
起動後 `http://localhost:8080/` にアクセスすると画面が表示される。

環境変数 `DEV_MODE=1` を設定すると、静的ファイルを埋め込みではなく `web/static` から直接読み込む(フロントエンド修正の都度の再ビルドが不要になる)。

## RaspberryPi Zero向けビルド

```sh
make build-rpi
```

`GOOS=linux GOARCH=arm GOARM=6 CGO_ENABLED=0` でクロスコンパイルし、`bin/kondate-supporter-armv6` を生成する。

## デプロイ手順(概要)

1. `make build-rpi` でバイナリを生成
2. `scp bin/kondate-supporter-armv6 pi@<host>:/home/pi/kondate-supporter/`
3. RaspberryPi Zero上でsystemdサービスとして登録し常時稼働させる
4. DBファイルは配置先の `data/kondate.db` に作成される
