# 開発起動と配置用ビルドの入口。Git Bash/WSLのshで実行する前提。

# WindowsではGOEXEが ".exe"、Linux(WSL含む)では空になる。
GOEXE := $(shell go env GOEXE)

# 配置用ビルドの共通リンカフラグ。シンボルを除いて小さくする。-ldflagsは2回書くと後の方だけが効くため、ターゲット固有のフラグはこの後ろに足す。
RELEASE_LDFLAGS := -s -w

# 引数なしのmakeで開発サーバーが起動しないよう、ターゲットの一覧を出す。
.DEFAULT_GOAL := help

.PHONY: run build-rpi build-win help

# 開発起動。go runは実行のたびにバイナリのパスが変わりWindowsファイアウォールの許可を何度も求められるため、固定パスへビルドしてから実行する。
# DEV_MODE=1 で画面ファイルをディスクから配信し、HTML/JSの変更をビルドし直さずに反映する。
run: ## 開発起動(DEV_MODE=1、:8080)
	go build -o bin/kondate-supporter$(GOEXE) ./cmd/server
	DEV_MODE=1 ./bin/kondate-supporter$(GOEXE)

# RaspberryPi Zero(ARMv6)向けクロスコンパイル。
build-rpi: ## RaspberryPi Zero(ARMv6)向けにビルドする
	GOOS=linux GOARCH=arm GOARM=6 CGO_ENABLED=0 go build -trimpath -ldflags="$(RELEASE_LDFLAGS)" -o bin/kondate-supporter-linux-armv6 ./cmd/server

# RaspberryPiを用意するまでのつなぎとして、Windows上で常用するためのビルド。画面はembedから配信する。
# 誤って閉じないよう -H windowsgui でコンソールを出さない。ログを見る場所が無くなるので、-tags windowsgui のときだけログをDBと同じフォルダの kondate.log に追記する。
build-win: ## Windows常用(つなぎ)向けにビルドする(コンソールなし)
	GOOS=windows CGO_ENABLED=0 go build -trimpath -tags windowsgui -ldflags="$(RELEASE_LDFLAGS) -H windowsgui" -o bin/kondate-supporter-windows.exe ./cmd/server

# ターゲット行末尾の「## 説明」を拾って一覧にする。ターゲットを増やしてもここは書き換えない。
help: ## ターゲットの一覧を表示する
	@awk 'BEGIN {FS = ":.*## "} /^[a-zA-Z0-9_-]+:.*## / {printf "  %-10s %s\n", $$1, $$2}' $(MAKEFILE_LIST)
