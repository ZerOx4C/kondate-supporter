package handler

import (
	"io/fs"
	"net/http"
)

// devModeStyle は開発モードの画面の背景に敷く模様のCSS。
const devModeStyle = "body { background: #fff url(\"dev-mode.svg\") repeat; }\n"

// NewRouter はルーティングを登録したhttp.Handlerを返す。
func NewRouter(staticFS fs.FS, recipes *RecipeHandler, devMode bool) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("GET /dev-mode.css", devModeCSS(devMode))
	mux.HandleFunc("GET /api/recipes", recipes.List)
	mux.HandleFunc("POST /api/recipes", recipes.Create)
	mux.HandleFunc("POST /api/recipes/import", recipes.Import)
	mux.HandleFunc("GET /api/recipes/{id}", recipes.Get)
	mux.HandleFunc("PUT /api/recipes/{id}", recipes.Update)
	mux.HandleFunc("DELETE /api/recipes/{id}", recipes.Delete)
	mux.HandleFunc("POST /api/recipes/{id}/cooked", recipes.IncrementCooked)
	mux.HandleFunc("DELETE /api/recipes/{id}/cooked", recipes.DecrementCooked)
	mux.HandleFunc("PUT /api/recipes/{id}/bookmark", recipes.PutBookmark)
	mux.HandleFunc("DELETE /api/recipes/{id}/bookmark", recipes.DeleteBookmark)
	mux.HandleFunc("PUT /api/recipes/{id}/image", recipes.PutImage)
	mux.HandleFunc("DELETE /api/recipes/{id}/image", recipes.DeleteImage)
	mux.HandleFunc("GET /api/recipes/{id}/image", recipes.GetImage)
	mux.HandleFunc("GET /api/tags", recipes.ListTags)
	mux.HandleFunc("GET /{$}", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/recipes.html", http.StatusFound)
	})
	mux.Handle("GET /", http.FileServerFS(staticFS))

	return mux
}

// devModeCSS は開発モードの背景の模様を指定するCSSを返す。開発モードでないときは、画面を開くたびに
// 読み込みエラーがコンソールに出ないよう、中身が空のCSSを200で返す。
func devModeCSS(devMode bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/css; charset=utf-8")
		if devMode {
			_, _ = w.Write([]byte(devModeStyle))
		}
	}
}
