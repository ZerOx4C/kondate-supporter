package handler

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"

	"kondate-supporter/internal/model"
	"kondate-supporter/internal/service"
)

type RecipeHandler struct {
	svc *service.RecipeService
}

func NewRecipeHandler(svc *service.RecipeService) *RecipeHandler {
	return &RecipeHandler{svc: svc}
}

type recipeRequest struct {
	Name string `json:"name"`
	Body string `json:"body"`
}

func (h *RecipeHandler) List(w http.ResponseWriter, r *http.Request) {
	recipes, err := h.svc.List(r.Context())
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, recipes)
}

func (h *RecipeHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	rec, err := h.svc.Get(r.Context(), id)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, rec)
}

func (h *RecipeHandler) Create(w http.ResponseWriter, r *http.Request) {
	req, ok := decodeRecipeRequest(w, r)
	if !ok {
		return
	}
	rec, err := h.svc.Create(r.Context(), req.Name, req.Body)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, rec)
}

func (h *RecipeHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	req, ok := decodeRecipeRequest(w, r)
	if !ok {
		return
	}
	rec, err := h.svc.Update(r.Context(), id, req.Name, req.Body)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, rec)
}

func (h *RecipeHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	if err := h.svc.Delete(r.Context(), id); err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

func (h *RecipeHandler) IncrementCooked(w http.ResponseWriter, r *http.Request) {
	h.changeCooked(w, r, h.svc.IncrementCookedCount)
}

func (h *RecipeHandler) DecrementCooked(w http.ResponseWriter, r *http.Request) {
	h.changeCooked(w, r, h.svc.DecrementCookedCount)
}

func (h *RecipeHandler) changeCooked(w http.ResponseWriter, r *http.Request, change func(context.Context, int64) (model.Recipe, error)) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	rec, err := change(r.Context(), id)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, rec)
}

// parseID はパスの{id}を読む。不正ならエラー応答を書いてfalseを返す。
func parseID(w http.ResponseWriter, r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id < 1 {
		writeError(w, http.StatusBadRequest, "IDが不正です")
		return 0, false
	}
	return id, true
}

func decodeRecipeRequest(w http.ResponseWriter, r *http.Request) (recipeRequest, bool) {
	var req recipeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "リクエストの形式が不正です")
		return req, false
	}
	return req, true
}

// writeServiceError はserviceのエラーをHTTPステータスに振り分けて書き出す。
func writeServiceError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, service.ErrNameRequired):
		writeError(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, service.ErrNotFound):
		writeError(w, http.StatusNotFound, err.Error())
	default:
		log.Printf("handler: %v", err)
		writeError(w, http.StatusInternalServerError, "サーバー内部でエラーが発生しました")
	}
}
