//go:build windowsgui

package main

import (
	"log"
	"os"
	"path/filepath"
)

// setupLogOutput は make build-win のとき(コンソールが無い)だけビルドされ、ログをDBと同じフォルダの kondate.log に追記する。
// 開けなくてもサーバーは起動を続ける。
func setupLogOutput(dbPath string) {
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return
	}
	f, err := os.OpenFile(filepath.Join(dir, "kondate.log"), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	if err != nil {
		return
	}
	log.SetOutput(f)
}
