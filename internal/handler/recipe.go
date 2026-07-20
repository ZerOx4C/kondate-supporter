package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"kondate-supporter/internal/repository"
)

// RecipeHandler はレシピ関連のHTTPエンドポイントを提供する。
type RecipeHandler struct {
	repo *repository.RecipeRepository
}

func NewRecipeHandler(repo *repository.RecipeRepository) *RecipeHandler {
	return &RecipeHandler{repo: repo}
}

type recipeIngredientRequest struct {
	IngredientID int64   `json:"ingredientId"`
	Quantity     float64 `json:"quantity"`
}

type recipeRequest struct {
	Name        string                    `json:"name"`
	Description string                    `json:"description"`
	Servings    int                       `json:"servings"`
	Ingredients []recipeIngredientRequest `json:"ingredients"`
}

func (req recipeRequest) validate() (name, description string, servings int, items []repository.RecipeIngredientInput, err error) {
	name = strings.TrimSpace(req.Name)
	if name == "" {
		return "", "", 0, nil, errors.New("nameは必須です")
	}
	description = strings.TrimSpace(req.Description)

	if req.Servings <= 0 {
		return "", "", 0, nil, errors.New("servingsは1以上である必要があります")
	}

	seen := make(map[int64]struct{}, len(req.Ingredients))
	items = make([]repository.RecipeIngredientInput, 0, len(req.Ingredients))
	for _, ing := range req.Ingredients {
		if ing.Quantity <= 0 {
			return "", "", 0, nil, errors.New("ingredientsのquantityは正の数である必要があります")
		}
		if _, dup := seen[ing.IngredientID]; dup {
			return "", "", 0, nil, errors.New("ingredientsに同じingredientIdが重複しています")
		}
		seen[ing.IngredientID] = struct{}{}
		items = append(items, repository.RecipeIngredientInput{
			IngredientID: ing.IngredientID,
			Quantity:     ing.Quantity,
		})
	}
	return name, description, req.Servings, items, nil
}

type recipeIngredientResponse struct {
	IngredientID int64   `json:"ingredientId"`
	Name         string  `json:"name"`
	Unit         string  `json:"unit"`
	Quantity     float64 `json:"quantity"`
}

type recipeResponse struct {
	ID          int64                      `json:"id"`
	Name        string                     `json:"name"`
	Description string                     `json:"description"`
	Servings    int                        `json:"servings"`
	Ingredients []recipeIngredientResponse `json:"ingredients"`
}

func toRecipeResponse(detail repository.RecipeDetail) recipeResponse {
	ingredients := make([]recipeIngredientResponse, 0, len(detail.Ingredients))
	for _, ing := range detail.Ingredients {
		ingredients = append(ingredients, recipeIngredientResponse{
			IngredientID: ing.IngredientID,
			Name:         ing.Name,
			Unit:         ing.Unit,
			Quantity:     ing.Quantity,
		})
	}
	return recipeResponse{
		ID:          detail.Recipe.ID,
		Name:        detail.Recipe.Name,
		Description: detail.Recipe.Description,
		Servings:    detail.Recipe.Servings,
		Ingredients: ingredients,
	}
}

func (h *RecipeHandler) List(w http.ResponseWriter, r *http.Request) {
	recipes, err := h.repo.List(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "サーバー内部エラーが発生しました")
		return
	}
	writeJSON(w, http.StatusOK, recipes)
}

func (h *RecipeHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req recipeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "リクエストの形式が不正です")
		return
	}
	name, description, servings, items, err := req.validate()
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	detail, err := h.repo.Create(r.Context(), name, description, servings, items)
	if err != nil {
		h.handleError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, toRecipeResponse(detail))
}

func (h *RecipeHandler) Get(w http.ResponseWriter, r *http.Request) {
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
	writeJSON(w, http.StatusOK, toRecipeResponse(detail))
}

func (h *RecipeHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := parsePathInt64(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "idが不正です")
		return
	}
	var req recipeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "リクエストの形式が不正です")
		return
	}
	name, description, servings, items, err := req.validate()
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	detail, err := h.repo.Update(r.Context(), id, name, description, servings, items)
	if err != nil {
		h.handleError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toRecipeResponse(detail))
}

func (h *RecipeHandler) Delete(w http.ResponseWriter, r *http.Request) {
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

func (h *RecipeHandler) handleError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, repository.ErrNotFound):
		writeError(w, http.StatusNotFound, "レシピが見つかりません")
	case errors.Is(err, repository.ErrIngredientNotFound):
		writeError(w, http.StatusBadRequest, "存在しない食材が指定されています")
	case errors.Is(err, repository.ErrInUse):
		writeError(w, http.StatusConflict, "献立で使用中のレシピは削除できません")
	default:
		writeError(w, http.StatusInternalServerError, "サーバー内部エラーが発生しました")
	}
}
