package model

// Plan は献立に置いたレシピの1件。Dateは"YYYY-MM-DD"で、nilなら全期間で共通の「毎日」か「候補」。
// Mealは"breakfast"・"lunch"・"dinner"・"candidate"のどれかで、毎日ならnil。
// "candidate"は日付がnilの行だけが取り、献立の候補を表す。
type Plan struct {
	ID       int64   `json:"id"`
	Date     *string `json:"date"`
	Meal     *string `json:"meal"`
	RecipeID int64   `json:"recipe_id"`
}
