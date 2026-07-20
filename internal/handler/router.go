package handler

import (
	"io/fs"
	"net/http"
)

// NewRouter はすべてのHTTPルートを1つのmuxにまとめる。staticFSは
// フロントエンド(index.html, css, js)を "/" で配信する。
func NewRouter(staticFS fs.FS) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", handleHealthz)
	mux.Handle("GET /", http.FileServerFS(staticFS))

	// TODO: ingredient/stock/recipe/plan/shoppinglist のAPIルートをここに登録する。

	return mux
}

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"ok"}`))
}
