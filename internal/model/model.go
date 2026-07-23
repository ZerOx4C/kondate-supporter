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

// Recipe はレシピ本体。Servingsはこのレシピの分量が何人分かを表し、
// Planに登録する人数との比率で材料の倍率を計算する際に使う。
type Recipe struct {
	ID       int64  `json:"id"`
	Name     string `json:"name"`
	URL      string `json:"url"`
	Servings int    `json:"servings"`
	ImageExt string `json:"imageExt"`
}

// RecipeIngredient はレシピが必要とする食材の数量。
type RecipeIngredient struct {
	ID           int64   `json:"id"`
	RecipeID     int64   `json:"recipeId"`
	IngredientID int64   `json:"ingredientId"`
	Quantity     float64 `json:"quantity"`
}

// Plan は特定の日付に特定のRecipeをServings人分作ることを表す。
// 1日に複数品作る場合は、同じDateを持つ複数のPlan行になる。
// MealTimeは"morning"/"noon"/"night"/"other"のいずれか。
type Plan struct {
	ID       int64  `json:"id"`
	Date     string `json:"date"`
	RecipeID int64  `json:"recipeId"`
	Servings int    `json:"servings"`
	MealTime string `json:"mealTime"`
}
