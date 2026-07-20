package model

// Ingredient は食材マスタ。数量・単位の換算は意図的にサポートしない。
// この食材を参照する数量(在庫・レシピ材料)は常にこのUnitで記録される。
type Ingredient struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
	Unit string `json:"unit"`
}

// Stock は食材ごとの現在の在庫数量。
type Stock struct {
	ID           int64   `json:"id"`
	IngredientID int64   `json:"ingredientId"`
	Quantity     float64 `json:"quantity"`
}

// Recipe はレシピ本体。
type Recipe struct {
	ID          int64
	Name        string
	Description string
}

// RecipeIngredient はレシピが必要とする食材の数量。
type RecipeIngredient struct {
	ID           int64
	RecipeID     int64
	IngredientID int64
	Quantity     float64
}

// Plan は特定の日付に特定のRecipeをServings人分作ることを表す。
// 1日に複数品作る場合は、同じDateを持つ複数のPlan行になる。
type Plan struct {
	ID       int64
	Date     string
	RecipeID int64
	Servings int
}
