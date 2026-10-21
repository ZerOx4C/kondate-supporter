package model

// Recipe はレシピ。Bodyは材料・調味料・手順を含む自由テキスト。CookedCountは作った回数。
// HasImageは画像の有無で、画像のバイト列そのものは持たない。
// ImageVersionは画像を保存した回数で、画像URLのキャッシュ切り替えに使う。
type Recipe struct {
	ID           int64  `json:"id"`
	Name         string `json:"name"`
	Body         string `json:"body"`
	CookedCount  int64  `json:"cooked_count"`
	HasImage     bool   `json:"-"`
	ImageVersion int64  `json:"-"`
}
