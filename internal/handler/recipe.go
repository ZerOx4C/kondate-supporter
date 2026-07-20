package handler

import "kondate-supporter/internal/repository"

// RecipeHandler はレシピ関連のHTTPエンドポイントを提供する。
// TODO: ハンドラを実装し、NewRouterに登録する。
type RecipeHandler struct {
	repo *repository.RecipeRepository
}

func NewRecipeHandler(repo *repository.RecipeRepository) *RecipeHandler {
	return &RecipeHandler{repo: repo}
}
