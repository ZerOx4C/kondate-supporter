# 開発起動と配置用ビルドの入口。Git Bash/WSLのshで実行する前提。

# WindowsではGOEXEが ".exe"、Linux(WSL含む)では空になる。
GOEXE := $(shell go env GOEXE)

# 配置用ビルドの共通フラグ。CGOを使わず、配置しやすいようシンボルを除いて小さくする。
RELEASE_FLAGS := -trimpath -ldflags="-s -w"

.PHONY: run build-rpi build-win

# 開発起動。go runは実行のたびにバイナリのパスが変わりWindowsファイアウォールの許可を何度も求められるため、固定パスへビルドしてから実行する。
# DEV_MODE=1 で画面ファイルをディスクから配信し、HTML/JSの変更をビルドし直さずに反映する。
run:
	go build -o bin/kondate-supporter$(GOEXE) ./cmd/server
	DEV_MODE=1 ./bin/kondate-supporter$(GOEXE)

# RaspberryPi Zero(ARMv6)向けクロスコンパイル。
build-rpi:
	GOOS=linux GOARCH=arm GOARM=6 CGO_ENABLED=0 go build $(RELEASE_FLAGS) -o bin/kondate-supporter-linux-armv6 ./cmd/server

# RaspberryPiを用意するまでのつなぎとして、Windows上で常用するためのビルド。画面はembedから配信する。
build-win:
	GOOS=windows CGO_ENABLED=0 go build $(RELEASE_FLAGS) -o bin/kondate-supporter-windows.exe ./cmd/server
