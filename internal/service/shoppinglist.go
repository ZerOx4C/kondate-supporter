package service

import "kondate-supporter/internal/repository"

// ShoppingListService は現在の在庫数量をもとに、登録された献立に対して
// 不足している食材を算出する。
// TODO: 不足分算出ロジックを実装する。
type ShoppingListService struct {
	planRepo   *repository.PlanRepository
	recipeRepo *repository.RecipeRepository
	stockRepo  *repository.StockRepository
}

func NewShoppingListService(
	planRepo *repository.PlanRepository,
	recipeRepo *repository.RecipeRepository,
	stockRepo *repository.StockRepository,
) *ShoppingListService {
	return &ShoppingListService{
		planRepo:   planRepo,
		recipeRepo: recipeRepo,
		stockRepo:  stockRepo,
	}
}
