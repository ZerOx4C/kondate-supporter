package handler

import (
	"bytes"
	"encoding/json"
	"net/http"

	"kondate-supporter/internal/model"
	"kondate-supporter/internal/service"
)

type PlanHandler struct {
	svc *service.PlanService
}

func NewPlanHandler(svc *service.PlanService) *PlanHandler {
	return &PlanHandler{svc: svc}
}

type planRequest struct {
	Date     *string `json:"date"`
	Meal     *string `json:"meal"`
	RecipeID *int64  `json:"recipe_id"`
	Memo     *string `json:"memo"`
	Index    int     `json:"index"`
}

func (h *PlanHandler) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	plans, err := h.svc.List(r.Context(), q.Get("from"), q.Get("to"))
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, plans)
}

func (h *PlanHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req planRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "リクエストの形式が不正です")
		return
	}
	// レシピかメモのどちらか一方だけを受ける
	if (req.RecipeID == nil) == (req.Memo == nil) {
		writeError(w, http.StatusBadRequest, "リクエストの形式が不正です")
		return
	}
	var e model.Plan
	var err error
	if req.Memo != nil {
		e, err = h.svc.AddMemo(r.Context(), req.Date, req.Meal, *req.Memo, req.Index)
	} else {
		e, err = h.svc.Add(r.Context(), req.Date, req.Meal, *req.RecipeID, req.Index)
	}
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, e)
}

type planMoveRequest struct {
	Date  *string `json:"date"`
	Meal  *string `json:"meal"`
	Index int     `json:"index"`
}

func (h *PlanHandler) Move(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	var req planMoveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "リクエストの形式が不正です")
		return
	}
	e, err := h.svc.Move(r.Context(), id, req.Date, req.Meal, req.Index)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, e)
}

type planMemoRequest struct {
	Memo *string `json:"memo"`
}

func (h *PlanHandler) UpdateMemo(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	var req planMemoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Memo == nil {
		writeError(w, http.StatusBadRequest, "リクエストの形式が不正です")
		return
	}
	e, err := h.svc.UpdateMemo(r.Context(), id, *req.Memo)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, e)
}

type planServingsRequest struct {
	Servings json.RawMessage `json:"servings"`
}

// UpdateServings は献立の人数を書き換える。servingsがnullならレシピの人数に戻す。キーが無い要求は形式の誤りにする。
func (h *PlanHandler) UpdateServings(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	var req planServingsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || len(req.Servings) == 0 {
		writeError(w, http.StatusBadRequest, "リクエストの形式が不正です")
		return
	}
	var servings *int64
	if string(bytes.TrimSpace(req.Servings)) != "null" {
		n, err := parseIntLiteral(req.Servings)
		if err != nil {
			writeServiceError(w, service.ErrPlanServingsInvalid)
			return
		}
		servings = &n
	}
	e, err := h.svc.UpdateServings(r.Context(), id, servings)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, e)
}

func (h *PlanHandler) Delete(w http.ResponseWriter, r *http.Request) {
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
