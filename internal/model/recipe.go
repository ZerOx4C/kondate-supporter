package model

// Recipe はレシピ。Bodyは材料・調味料・手順を含む自由テキスト。
type Recipe struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
	Body string `json:"body"`
}
