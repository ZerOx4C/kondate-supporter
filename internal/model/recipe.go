package model

// Recipe はレシピ。Bodyは材料・調味料・手順を含む自由テキスト。CookedCountは作った回数。
// Servingsは人数(0〜99)で、0は未設定。
// HasImageは画像の有無で、画像のバイト列そのものは持たない。
// ImageVersionは画像を保存した回数で、画像URLのキャッシュ切り替えに使う。
// Tagsはタグ名の配列(タグのid昇順)で、タグが無ければ空配列。
// Bookmarkedはブックマーク中かどうか。
// Ingredientsは材料の配列(並び順どおり)で、材料が無ければ空配列。
type Recipe struct {
	ID           int64        `json:"id"`
	Name         string       `json:"name"`
	Body         string       `json:"body"`
	CookedCount  int64        `json:"cooked_count"`
	Servings     int64        `json:"servings"`
	Tags         []string     `json:"tags"`
	Bookmarked   bool         `json:"bookmarked"`
	Ingredients  []Ingredient `json:"ingredients"`
	HasImage     bool         `json:"-"`
	ImageVersion int64        `json:"-"`
}

// Ingredient は材料1行。Formatは量の文字列のうち数の位置を{0}で表したもの。
// Quantityは量に数が無ければnilで、そのときFormatは{0}を含まない量の文字列そのもの。
// ReferenceQuantity・ReferenceFormatは書かなくてもよい参考量で、量と同じ形で持つ。
// 参考量が空ならReferenceQuantityはnil、ReferenceFormatは空文字。
type Ingredient struct {
	Name              string   `json:"name"`
	Quantity          *float64 `json:"quantity"`
	Format            string   `json:"format"`
	ReferenceQuantity *float64 `json:"reference_quantity"`
	ReferenceFormat   string   `json:"reference_format"`
}
