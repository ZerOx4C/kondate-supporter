package handler

import (
	"net/http"

	"kondate-supporter/internal/service"
)

// ShoppingListHandler は算出した買い物リストを提供する。
type ShoppingListHandler struct {
	svc *service.ShoppingListService
}

func NewShoppingListHandler(svc *service.ShoppingListService) *ShoppingListHandler {
	return &ShoppingListHandler{svc: svc}
}

type shoppingListItemResponse struct {
	IngredientID int64   `json:"ingredientId"`
	Name         string  `json:"name"`
	Unit         string  `json:"unit"`
	Required     float64 `json:"required"`
	Stock        float64 `json:"stock"`
	Shortage     float64 `json:"shortage"`
}

func (h *ShoppingListHandler) List(w http.ResponseWriter, r *http.Request) {
	from, to, err := parseDateRangeQuery(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	items, err := h.svc.Calculate(r.Context(), from, to)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "サーバー内部エラーが発生しました")
		return
	}

	res := make([]shoppingListItemResponse, 0, len(items))
	for _, item := range items {
		res = append(res, shoppingListItemResponse{
			IngredientID: item.IngredientID,
			Name:         item.Name,
			Unit:         item.Unit,
			Required:     item.Required,
			Stock:        item.Stock,
			Shortage:     item.Shortage,
		})
	}
	writeJSON(w, http.StatusOK, res)
}
