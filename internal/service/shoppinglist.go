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

// SummaryItem は献立に登場する食材と在庫がある食材の和集合について、
// 必要量と在庫からの残り(不足時はマイナス)を1件分にまとめたもの。
type SummaryItem struct {
	IngredientID int64
	Name         string
	Unit         string
	Required     float64
	Remaining    float64
}

// ShoppingListService は現在の在庫数量をもとに、登録された献立に対して
// 不足している食材や、食材ごとの必要量・在庫の残りを算出する。
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

// aggregate は指定された期間(from/toは省略可)の献立に必要な食材の合計量と、
// 現在の在庫を集計する。Calculate/Summarizeの共通処理。
func (s *ShoppingListService) aggregate(ctx context.Context, from, to string) (map[int64]*requiredAmount, map[int64]repository.StockDetail, error) {
	plans, err := s.planRepo.List(ctx, from, to)
	if err != nil {
		return nil, nil, err
	}

	recipeCache := make(map[int64]repository.RecipeDetail)
	required := make(map[int64]*requiredAmount)

	for _, plan := range plans {
		if plan.RecipeID == nil {
			// レシピに依存しないメモ行は食材集計の対象外。
			continue
		}
		recipeDetail, ok := recipeCache[*plan.RecipeID]
		if !ok {
			recipeDetail, err = s.recipeRepo.Get(ctx, *plan.RecipeID)
			if err != nil {
				return nil, nil, err
			}
			recipeCache[*plan.RecipeID] = recipeDetail
		}

		if recipeDetail.Recipe.Servings <= 0 {
			// 基準人数が不正なレシピは倍率計算ができないため、この献立の寄与をスキップする。
			continue
		}
		factor := float64(plan.Servings) / float64(recipeDetail.Recipe.Servings)

		overrideByIngredient := make(map[int64]float64, len(plan.IngredientOverrides))
		for _, o := range plan.IngredientOverrides {
			overrideByIngredient[o.IngredientID] = o.Quantity
		}

		for _, ing := range recipeDetail.Ingredients {
			amount, ok := required[ing.IngredientID]
			if !ok {
				amount = &requiredAmount{name: ing.Name, unit: ing.Unit}
				required[ing.IngredientID] = amount
			}
			qty := ing.Quantity * factor
			if o, ok := overrideByIngredient[ing.IngredientID]; ok {
				qty = o
			}
			amount.quantity += qty
		}
	}

	stocks, err := s.stockRepo.List(ctx)
	if err != nil {
		return nil, nil, err
	}
	stockByIngredient := make(map[int64]repository.StockDetail, len(stocks))
	for _, stock := range stocks {
		stockByIngredient[stock.IngredientID] = stock
	}

	return required, stockByIngredient, nil
}

// Calculate は指定された期間(from/toは省略可)の献立に必要な食材の合計量を
// 集計し、在庫と比較して不足している食材を返す。
func (s *ShoppingListService) Calculate(ctx context.Context, from, to string) ([]ShortageItem, error) {
	required, stocks, err := s.aggregate(ctx, from, to)
	if err != nil {
		return nil, err
	}

	shortages := make([]ShortageItem, 0, len(required))
	for ingredientID, amount := range required {
		stock := stocks[ingredientID].Quantity
		shortage := amount.quantity - stock
		if shortage <= 0 {
			continue
		}
		shortages = append(shortages, ShortageItem{
			IngredientID: ingredientID,
			Name:         amount.name,
			Unit:         amount.unit,
			Required:     amount.quantity,
			Stock:        stock,
			Shortage:     shortage,
		})
	}

	sort.Slice(shortages, func(i, j int) bool {
		return shortages[i].IngredientID < shortages[j].IngredientID
	})
	return shortages, nil
}

// Summarize は指定された期間(from/toは省略可)の献立に登場する食材と、
// 在庫が0より多い食材の和集合について、必要量と在庫からの残りを返す。
func (s *ShoppingListService) Summarize(ctx context.Context, from, to string) ([]SummaryItem, error) {
	required, stocks, err := s.aggregate(ctx, from, to)
	if err != nil {
		return nil, err
	}

	summaries := make([]SummaryItem, 0, len(required)+len(stocks))
	for ingredientID, amount := range required {
		stock := stocks[ingredientID].Quantity
		summaries = append(summaries, SummaryItem{
			IngredientID: ingredientID,
			Name:         amount.name,
			Unit:         amount.unit,
			Required:     amount.quantity,
			Remaining:    stock - amount.quantity,
		})
	}
	for ingredientID, stock := range stocks {
		if _, ok := required[ingredientID]; ok {
			continue
		}
		if stock.Quantity <= 0 {
			continue
		}
		summaries = append(summaries, SummaryItem{
			IngredientID: ingredientID,
			Name:         stock.Name,
			Unit:         stock.Unit,
			Required:     0,
			Remaining:    stock.Quantity,
		})
	}

	sort.Slice(summaries, func(i, j int) bool {
		return summaries[i].IngredientID < summaries[j].IngredientID
	})
	return summaries, nil
}
