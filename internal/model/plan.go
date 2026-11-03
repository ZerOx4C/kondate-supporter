package model

// Plan は献立に置いたレシピかメモの1件。レシピの行はMemoがnil、メモの行はRecipeIDがnilで、どちらか一方だけを持つ。
// Dateは"YYYY-MM-DD"で、nilなら全期間で共通の「毎日」か「候補」。
// Mealは"breakfast"・"lunch"・"dinner"・"candidate"のどれかで、毎日ならnil。
// "candidate"は日付がnilの行だけが取り、献立の候補を表す。
// Servingsは献立だけの人数(1〜99)で、nilならレシピの人数に従う。メモの行は常にnil。
type Plan struct {
	ID       int64   `json:"id"`
	Date     *string `json:"date"`
	Meal     *string `json:"meal"`
	RecipeID *int64  `json:"recipe_id"`
	Memo     *string `json:"memo"`
	Servings *int64  `json:"servings"`
}
