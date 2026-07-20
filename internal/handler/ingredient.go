package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"kondate-supporter/internal/repository"
)

// IngredientHandler は食材関連のHTTPエンドポイントを提供する。
type IngredientHandler struct {
	repo *repository.IngredientRepository
}

func NewIngredientHandler(repo *repository.IngredientRepository) *IngredientHandler {
	return &IngredientHandler{repo: repo}
}

type ingredientRequest struct {
	Name string `json:"name"`
	Unit string `json:"unit"`
}

func (req ingredientRequest) validate() (name, unit string, err error) {
	name = strings.TrimSpace(req.Name)
	unit = strings.TrimSpace(req.Unit)
	if name == "" {
		return "", "", errors.New("nameは必須です")
	}
	if unit == "" {
		return "", "", errors.New("unitは必須です")
	}
	return name, unit, nil
}

func (h *IngredientHandler) List(w http.ResponseWriter, r *http.Request) {
	ingredients, err := h.repo.List(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "サーバー内部エラーが発生しました")
		return
	}
	writeJSON(w, http.StatusOK, ingredients)
}

func (h *IngredientHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req ingredientRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "リクエストの形式が不正です")
		return
	}
	name, unit, err := req.validate()
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	ing, err := h.repo.Create(r.Context(), name, unit)
	if err != nil {
		h.handleError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, ing)
}

func (h *IngredientHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := parsePathInt64(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "idが不正です")
		return
	}
	ing, err := h.repo.Get(r.Context(), id)
	if err != nil {
		h.handleError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, ing)
}

func (h *IngredientHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := parsePathInt64(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "idが不正です")
		return
	}
	var req ingredientRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "リクエストの形式が不正です")
		return
	}
	name, unit, err := req.validate()
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	ing, err := h.repo.Update(r.Context(), id, name, unit)
	if err != nil {
		h.handleError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, ing)
}

func (h *IngredientHandler) Delete(w http.ResponseWriter, r *http.Request) {
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

func (h *IngredientHandler) handleError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, repository.ErrNotFound):
		writeError(w, http.StatusNotFound, "食材が見つかりません")
	case errors.Is(err, repository.ErrDuplicateName):
		writeError(w, http.StatusConflict, "同名の食材が既に存在します")
	case errors.Is(err, repository.ErrIngredientInUse):
		writeError(w, http.StatusConflict, "レシピで使用中の食材は削除できません")
	default:
		writeError(w, http.StatusInternalServerError, "サーバー内部エラーが発生しました")
	}
}
