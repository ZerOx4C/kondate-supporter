package model

// Plan は献立に置いたレシピの1件。Dateは"YYYY-MM-DD"で、nilなら全期間で共通の「毎日」に置いたもの。
type Plan struct {
	ID       int64   `json:"id"`
	Date     *string `json:"date"`
	RecipeID int64   `json:"recipe_id"`
}
