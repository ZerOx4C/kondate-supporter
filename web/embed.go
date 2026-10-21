package web

import (
	"embed"
	"io/fs"
)

//go:embed static
var staticFiles embed.FS

// StaticFS は web/static 配下を根とするファイルシステムを返す。
func StaticFS() (fs.FS, error) {
	return fs.Sub(staticFiles, "static")
}
