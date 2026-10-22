package handler

import (
	"io/fs"
	"net/http"
)

// NewRouter はルーティングを登録したhttp.Handlerを返す。
func NewRouter(staticFS fs.FS, recipes *RecipeHandler) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("GET /api/recipes", recipes.List)
	mux.HandleFunc("POST /api/recipes", recipes.Create)
	mux.HandleFunc("GET /api/recipes/{id}", recipes.Get)
	mux.HandleFunc("PUT /api/recipes/{id}", recipes.Update)
	mux.HandleFunc("DELETE /api/recipes/{id}", recipes.Delete)
	mux.HandleFunc("POST /api/recipes/{id}/cooked", recipes.IncrementCooked)
	mux.HandleFunc("DELETE /api/recipes/{id}/cooked", recipes.DecrementCooked)
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
