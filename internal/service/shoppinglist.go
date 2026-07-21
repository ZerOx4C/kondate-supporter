package service

import (
	"context"
	"sort"

	"kondate-supporter/internal/repository"
)

// ShortageItem は算出された不足食材1件分。repository層のDetail構造体と
// 同様、HTTP/JSONを意識せずJSONタグは付けない(レスポンス整形はhandler層の責務)。
type ShortageItem struct {
	IngredientID int64
	Name         string
	Unit         string
	Required     float64
	Stock        float64
	Shortage     float64
}

// SurplusItem は算出された余剰食材(在庫が必要量を上回り繰越になる食材)1件分。
type SurplusItem struct {
	IngredientID int64
	Name         string
	Unit         string
	Required     float64
	Stock        float64
	Surplus      float64
}

// ShoppingListService は現在の在庫数量をもとに、登録された献立に対して
// 不足している食材と繰越になる余剰食材を算出する。
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

type requiredAmount struct {
	name     string
	unit     string
	quantity float64
}

// Calculate は指定された期間(from/toは省略可)の献立に必要な食材の合計量を
// 集計し、在庫と比較して不足している食材(shortages)と、
// 必要量を上回り繰越になる食材(surpluses)をそれぞれ返す。
func (s *ShoppingListService) Calculate(ctx context.Context, from, to string) (shortages []ShortageItem, surpluses []SurplusItem, err error) {
	plans, err := s.planRepo.List(ctx, from, to)
	if err != nil {
		return nil, nil, err
	}
	if len(plans) == 0 {
		return []ShortageItem{}, []SurplusItem{}, nil
	}

	recipeCache := make(map[int64]repository.RecipeDetail)
	required := make(map[int64]*requiredAmount)

	for _, plan := range plans {
		recipeDetail, ok := recipeCache[plan.RecipeID]
		if !ok {
			recipeDetail, err = s.recipeRepo.Get(ctx, plan.RecipeID)
			if err != nil {
				return nil, nil, err
			}
			recipeCache[plan.RecipeID] = recipeDetail
		}

		if recipeDetail.Recipe.Servings <= 0 {
			// 基準人数が不正なレシピは倍率計算ができないため、この献立の寄与をスキップする。
			continue
		}
		factor := float64(plan.Servings) / float64(recipeDetail.Recipe.Servings)

		for _, ing := range recipeDetail.Ingredients {
			amount, ok := required[ing.IngredientID]
			if !ok {
				amount = &requiredAmount{name: ing.Name, unit: ing.Unit}
				required[ing.IngredientID] = amount
			}
			amount.quantity += ing.Quantity * factor
		}
	}

	stocks, err := s.stockRepo.List(ctx)
	if err != nil {
		return nil, nil, err
	}
	stockByIngredient := make(map[int64]float64, len(stocks))
	for _, stock := range stocks {
		stockByIngredient[stock.IngredientID] = stock.Quantity
	}

	shortages = make([]ShortageItem, 0, len(required))
	surpluses = make([]SurplusItem, 0, len(required))
	for ingredientID, amount := range required {
		stock := stockByIngredient[ingredientID]
		diff := amount.quantity - stock
		switch {
		case diff > 0:
			shortages = append(shortages, ShortageItem{
				IngredientID: ingredientID,
				Name:         amount.name,
				Unit:         amount.unit,
				Required:     amount.quantity,
				Stock:        stock,
				Shortage:     diff,
			})
		case diff < 0:
			surpluses = append(surpluses, SurplusItem{
				IngredientID: ingredientID,
				Name:         amount.name,
				Unit:         amount.unit,
				Required:     amount.quantity,
				Stock:        stock,
				Surplus:      -diff,
			})
		}
	}

	sort.Slice(shortages, func(i, j int) bool {
		return shortages[i].IngredientID < shortages[j].IngredientID
	})
	sort.Slice(surpluses, func(i, j int) bool {
		return surpluses[i].IngredientID < surpluses[j].IngredientID
	})

	return shortages, surpluses, nil
}
