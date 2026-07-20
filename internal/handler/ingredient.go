package handler

import "kondate-supporter/internal/repository"

// IngredientHandler は食材関連のHTTPエンドポイントを提供する。
// TODO: ハンドラを実装し、NewRouterに登録する。
type IngredientHandler struct {
	repo *repository.IngredientRepository
}

func NewIngredientHandler(repo *repository.IngredientRepository) *IngredientHandler {
	return &IngredientHandler{repo: repo}
}
