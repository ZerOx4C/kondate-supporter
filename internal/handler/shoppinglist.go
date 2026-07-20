package handler

import "kondate-supporter/internal/service"

// ShoppingListHandler は算出した買い物リストを提供する。
// TODO: ハンドラを実装し、NewRouterに登録する。
type ShoppingListHandler struct {
	svc *service.ShoppingListService
}

func NewShoppingListHandler(svc *service.ShoppingListService) *ShoppingListHandler {
	return &ShoppingListHandler{svc: svc}
}
