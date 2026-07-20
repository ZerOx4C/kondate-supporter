package handler

import "kondate-supporter/internal/repository"

// PlanHandler は献立関連のHTTPエンドポイントを提供する。
// TODO: ハンドラを実装し、NewRouterに登録する。
type PlanHandler struct {
	repo *repository.PlanRepository
}

func NewPlanHandler(repo *repository.PlanRepository) *PlanHandler {
	return &PlanHandler{repo: repo}
}
