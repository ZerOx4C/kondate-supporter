package handler

import "kondate-supporter/internal/repository"

// StockHandler は在庫関連のHTTPエンドポイントを提供する。
// TODO: ハンドラを実装し、NewRouterに登録する。
type StockHandler struct {
	repo *repository.StockRepository
}

func NewStockHandler(repo *repository.StockRepository) *StockHandler {
	return &StockHandler{repo: repo}
}
