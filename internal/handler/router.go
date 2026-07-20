package handler

import (
	"io/fs"
	"net/http"
)

// NewRouter はすべてのHTTPルートを1つのmuxにまとめる。staticFSは
// フロントエンド(index.html, css, js)を "/" で配信する。
func NewRouter(staticFS fs.FS, ingredientHandler *IngredientHandler, stockHandler *StockHandler) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", handleHealthz)

	mux.HandleFunc("GET /api/ingredients", ingredientHandler.List)
	mux.HandleFunc("POST /api/ingredients", ingredientHandler.Create)
	mux.HandleFunc("GET /api/ingredients/{id}", ingredientHandler.Get)
	mux.HandleFunc("PUT /api/ingredients/{id}", ingredientHandler.Update)
	mux.HandleFunc("DELETE /api/ingredients/{id}", ingredientHandler.Delete)

	mux.HandleFunc("GET /api/stocks", stockHandler.List)
	mux.HandleFunc("PUT /api/stocks/{ingredientId}", stockHandler.UpdateQuantity)

	// TODO: recipe/plan/shoppinglist のAPIルートをここに登録する。

	mux.Handle("GET /", http.FileServerFS(staticFS))

	return mux
}

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"ok"}`))
}
