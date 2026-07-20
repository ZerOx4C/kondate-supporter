package web

import (
	"embed"
	"io/fs"
)

//go:embed all:static
var staticFS embed.FS

// StaticFS は "static/" を起点とする埋め込みフロントエンドファイルを返す。
func StaticFS() (fs.FS, error) {
	return fs.Sub(staticFS, "static")
}
