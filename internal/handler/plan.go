package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"kondate-supporter/internal/repository"
)

// PlanHandler は献立関連のHTTPエンドポイントを提供する。
type PlanHandler struct {
	repo *repository.PlanRepository
}

func NewPlanHandler(repo *repository.PlanRepository) *PlanHandler {
	return &PlanHandler{repo: repo}
}

type planRequest struct {
	Date     string `json:"date"`
	RecipeID int64  `json:"recipeId"`
	Servings int    `json:"servings"`
}

func (req planRequest) validate() (date string, recipeID int64, servings int, err error) {
	if _, err := time.Parse(time.DateOnly, req.Date); err != nil {
		return "", 0, 0, errors.New("dateはYYYY-MM-DD形式である必要があります")
	}
	if req.Servings <= 0 {
		return "", 0, 0, errors.New("servingsは1以上である必要があります")
	}
	return req.Date, req.RecipeID, req.Servings, nil
}

type planResponse struct {
	ID         int64  `json:"id"`
	Date       string `json:"date"`
	RecipeID   int64  `json:"recipeId"`
	RecipeName string `json:"recipeName"`
	Servings   int    `json:"servings"`
}

func toPlanResponse(detail repository.PlanDetail) planResponse {
	return planResponse{
		ID:         detail.ID,
		Date:       detail.Date,
		RecipeID:   detail.RecipeID,
		RecipeName: detail.RecipeName,
		Servings:   detail.Servings,
	}
}

func (h *PlanHandler) List(w http.ResponseWriter, r *http.Request) {
	from := r.URL.Query().Get("from")
	to := r.URL.Query().Get("to")
	if from != "" {
		if _, err := time.Parse(time.DateOnly, from); err != nil {
			writeError(w, http.StatusBadRequest, "fromはYYYY-MM-DD形式である必要があります")
			return
		}
	}
	if to != "" {
		if _, err := time.Parse(time.DateOnly, to); err != nil {
			writeError(w, http.StatusBadRequest, "toはYYYY-MM-DD形式である必要があります")
			return
		}
	}

	plans, err := h.repo.List(r.Context(), from, to)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "サーバー内部エラーが発生しました")
		return
	}

	res := make([]planResponse, 0, len(plans))
	for _, p := range plans {
		res = append(res, toPlanResponse(p))
	}
	writeJSON(w, http.StatusOK, res)
}

func (h *PlanHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req planRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "リクエストの形式が不正です")
		return
	}
	date, recipeID, servings, err := req.validate()
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	detail, err := h.repo.Create(r.Context(), date, recipeID, servings)
	if err != nil {
		h.handleError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, toPlanResponse(detail))
}

func (h *PlanHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := parsePathInt64(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "idが不正です")
		return
	}
	detail, err := h.repo.Get(r.Context(), id)
	if err != nil {
		h.handleError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toPlanResponse(detail))
}

func (h *PlanHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := parsePathInt64(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "idが不正です")
		return
	}
	var req planRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "リクエストの形式が不正です")
		return
	}
	date, recipeID, servings, err := req.validate()
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	detail, err := h.repo.Update(r.Context(), id, date, recipeID, servings)
	if err != nil {
		h.handleError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toPlanResponse(detail))
}

func (h *PlanHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := parsePathInt64(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "idが不正です")
		return
	}
	if err := h.repo.Delete(r.Context(), id); err != nil {
		h.handleError(w, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

func (h *PlanHandler) handleError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, repository.ErrNotFound):
		writeError(w, http.StatusNotFound, "献立が見つかりません")
	case errors.Is(err, repository.ErrRecipeNotFound):
		writeError(w, http.StatusBadRequest, "存在しないレシピが指定されています")
	default:
		writeError(w, http.StatusInternalServerError, "サーバー内部エラーが発生しました")
	}
}
