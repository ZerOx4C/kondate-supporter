package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"kondate-supporter/internal/repository"
)

// StockHandler は在庫関連のHTTPエンドポイントを提供する。
type StockHandler struct {
	repo *repository.StockRepository
}

func NewStockHandler(repo *repository.StockRepository) *StockHandler {
	return &StockHandler{repo: repo}
}

type stockResponse struct {
	IngredientID int64   `json:"ingredientId"`
	Name         string  `json:"name"`
	Unit         string  `json:"unit"`
	Quantity     float64 `json:"quantity"`
	UpdatedAt    string  `json:"updatedAt"`
}

type stockUpdateRequest struct {
	Quantity float64 `json:"quantity"`
}

func (h *StockHandler) List(w http.ResponseWriter, r *http.Request) {
	details, err := h.repo.List(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "サーバー内部エラーが発生しました")
		return
	}

	res := make([]stockResponse, 0, len(details))
	for _, d := range details {
		res = append(res, stockResponse{
			IngredientID: d.IngredientID,
			Name:         d.Name,
			Unit:         d.Unit,
			Quantity:     d.Quantity,
			UpdatedAt:    d.UpdatedAt,
		})
	}
	writeJSON(w, http.StatusOK, res)
}

func (h *StockHandler) UpdateQuantity(w http.ResponseWriter, r *http.Request) {
	ingredientID, err := parsePathInt64(r, "ingredientId")
	if err != nil {
		writeError(w, http.StatusBadRequest, "ingredientIdが不正です")
		return
	}

	var req stockUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "リクエストの形式が不正です")
		return
	}
	if req.Quantity < 0 {
		writeError(w, http.StatusBadRequest, "quantityは負数にできません")
		return
	}

	if err := h.repo.UpdateQuantity(r.Context(), ingredientID, req.Quantity); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			writeError(w, http.StatusNotFound, "在庫が見つかりません")
			return
		}
		writeError(w, http.StatusInternalServerError, "サーバー内部エラーが発生しました")
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}
