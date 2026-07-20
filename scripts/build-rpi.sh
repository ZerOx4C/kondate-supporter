#!/bin/sh
# RaspberryPi Zero (ARMv6) 向けにクロスコンパイルし、必要に応じてscpで転送する。
#
# 使い方:
#   ./scripts/build-rpi.sh                  # ビルドのみ。bin/kondate-supporter-armv6 に出力
#   RPI_HOST=pi@raspberrypi.local ./scripts/build-rpi.sh   # ビルドしてPiのホームディレクトリに転送
set -eu

BINARY=kondate-supporter-armv6

GOOS=linux GOARCH=arm GOARM=6 CGO_ENABLED=0 go build -o "bin/$BINARY" ./cmd/server
echo "built bin/$BINARY"

if [ -n "${RPI_HOST:-}" ]; then
  scp "bin/$BINARY" "$RPI_HOST:~/kondate-supporter/"
  echo "deployed to $RPI_HOST:~/kondate-supporter/$BINARY"
fi
