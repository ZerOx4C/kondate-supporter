package handler

import (
	"io/fs"
	"net/http"
)

// NewRouter はルーティングを登録したhttp.Handlerを返す。
func NewRouter(staticFS fs.FS) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("GET /{$}", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/recipes.html", http.StatusFound)
	})
	mux.Handle("GET /", http.FileServerFS(staticFS))

	return mux
}
