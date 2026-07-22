package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"kondate-supporter/internal/repository"
	"kondate-supporter/internal/service"
)

// PlanHandler は献立関連のHTTPエンドポイントを提供する。
type PlanHandler struct {
	repo                *repository.PlanRepository
	shoppingListService *service.ShoppingListService
}

func NewPlanHandler(repo *repository.PlanRepository, shoppingListService *service.ShoppingListService) *PlanHandler {
	return &PlanHandler{repo: repo, shoppingListService: shoppingListService}
}

// validMealTimes は献立の食事区分として許可する値。
var validMealTimes = map[string]bool{
	"morning": true,
	"noon":    true,
	"night":   true,
	"other":   true,
}

type planIngredientOverrideRequest struct {
	IngredientID int64   `json:"ingredientId"`
	Quantity     float64 `json:"quantity"`
}

type planRequest struct {
	Date                string                          `json:"date"`
	RecipeID            *int64                          `json:"recipeId"`
	Servings            int                             `json:"servings"`
	MealTime            string                          `json:"mealTime"`
	Note                string                          `json:"note"`
	IngredientOverrides []planIngredientOverrideRequest `json:"ingredientOverrides"`
}

// validate はレシピに紐づく献立(RecipeIDが非nil)と、レシピに依存しない
// メモ(RecipeIDがnilかつnoteが非空)のいずれかとしてリクエストを検証する。
func (req planRequest) validate() (date string, recipeID *int64, servings int, mealTime, note string, overrides []repository.PlanIngredientOverride, err error) {
	if _, err := time.Parse(time.DateOnly, req.Date); err != nil {
		return "", nil, 0, "", "", nil, errors.New("dateはYYYY-MM-DD形式である必要があります")
	}
	if !validMealTimes[req.MealTime] {
		return "", nil, 0, "", "", nil, errors.New("mealTimeはmorning/noon/night/otherのいずれかである必要があります")
	}

	if req.RecipeID != nil {
		if req.Servings <= 0 {
			return "", nil, 0, "", "", nil, errors.New("servingsは1以上である必要があります")
		}
		overrides, err := validatePlanIngredientOverrides(req.IngredientOverrides)
		if err != nil {
			return "", nil, 0, "", "", nil, err
		}
		return req.Date, req.RecipeID, req.Servings, req.MealTime, "", overrides, nil
	}

	note = strings.TrimSpace(req.Note)
	if note == "" {
		return "", nil, 0, "", "", nil, errors.New("recipeIdまたはnoteのいずれかを指定してください")
	}
	return req.Date, nil, 0, req.MealTime, note, nil, nil
}

// validatePlanIngredientOverrides はingredientIdの重複と負のquantityを弾く。
func validatePlanIngredientOverrides(items []planIngredientOverrideRequest) ([]repository.PlanIngredientOverride, error) {
	seen := make(map[int64]struct{}, len(items))
	overrides := make([]repository.PlanIngredientOverride, 0, len(items))
	for _, item := range items {
		if item.Quantity < 0 {
			return nil, errors.New("ingredientOverridesのquantityは0以上である必要があります")
		}
		if _, dup := seen[item.IngredientID]; dup {
			return nil, errors.New("ingredientOverridesに同じingredientIdが重複しています")
		}
		seen[item.IngredientID] = struct{}{}
		overrides = append(overrides, repository.PlanIngredientOverride{
			IngredientID: item.IngredientID,
			Quantity:     item.Quantity,
		})
	}
	return overrides, nil
}

type planIngredientOverrideResponse struct {
	IngredientID int64   `json:"ingredientId"`
	Quantity     float64 `json:"quantity"`
}

type planResponse struct {
	ID                  int64                            `json:"id"`
	Date                string                           `json:"date"`
	RecipeID            *int64                           `json:"recipeId"`
	RecipeName          string                           `json:"recipeName"`
	Servings            int                              `json:"servings"`
	MealTime            string                           `json:"mealTime"`
	Note                string                           `json:"note"`
	IngredientOverrides []planIngredientOverrideResponse `json:"ingredientOverrides"`
}

type summaryItemResponse struct {
	IngredientID int64   `json:"ingredientId"`
	Name         string  `json:"name"`
	Unit         string  `json:"unit"`
	Required     float64 `json:"required"`
	Remaining    float64 `json:"remaining"`
}

func toPlanResponse(detail repository.PlanDetail) planResponse {
	overrides := make([]planIngredientOverrideResponse, 0, len(detail.IngredientOverrides))
	for _, o := range detail.IngredientOverrides {
		overrides = append(overrides, planIngredientOverrideResponse{
			IngredientID: o.IngredientID,
			Quantity:     o.Quantity,
		})
	}
	return planResponse{
		ID:                  detail.ID,
		Date:                detail.Date,
		RecipeID:            detail.RecipeID,
		RecipeName:          detail.RecipeName,
		Servings:            detail.Servings,
		MealTime:            detail.MealTime,
		Note:                detail.Note,
		IngredientOverrides: overrides,
	}
}

func (h *PlanHandler) List(w http.ResponseWriter, r *http.Request) {
	from, to, err := parseDateRangeQuery(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
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

// Summary は指定された期間の献立に登場する食材と在庫がある食材の和集合について、
// 必要量と在庫からの残りを返す。
func (h *PlanHandler) Summary(w http.ResponseWriter, r *http.Request) {
	from, to, err := parseDateRangeQuery(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	items, err := h.shoppingListService.Summarize(r.Context(), from, to)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "サーバー内部エラーが発生しました")
		return
	}

	res := make([]summaryItemResponse, 0, len(items))
	for _, item := range items {
		res = append(res, summaryItemResponse{
			IngredientID: item.IngredientID,
			Name:         item.Name,
			Unit:         item.Unit,
			Required:     item.Required,
			Remaining:    item.Remaining,
		})
	}
	writeJSON(w, http.StatusOK, res)
}

func (h *PlanHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req planRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "リクエストの形式が不正です")
		return
	}
	date, recipeID, servings, mealTime, note, _, err := req.validate()
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	detail, err := h.repo.Create(r.Context(), date, recipeID, servings, mealTime, note)
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
	date, recipeID, servings, mealTime, note, overrides, err := req.validate()
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	detail, err := h.repo.Update(r.Context(), id, date, recipeID, servings, mealTime, note, overrides)
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
