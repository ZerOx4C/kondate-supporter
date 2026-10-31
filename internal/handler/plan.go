package handler

import (
	"encoding/json"
	"net/http"

	"kondate-supporter/internal/service"
)

type PlanHandler struct {
	svc *service.PlanService
}

func NewPlanHandler(svc *service.PlanService) *PlanHandler {
	return &PlanHandler{svc: svc}
}

type planEntryRequest struct {
	Date     *string `json:"date"`
	RecipeID int64   `json:"recipe_id"`
	Index    int     `json:"index"`
}

func (h *PlanHandler) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	entries, err := h.svc.List(r.Context(), q.Get("from"), q.Get("to"))
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, entries)
}

func (h *PlanHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req planEntryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "リクエストの形式が不正です")
		return
	}
	e, err := h.svc.Add(r.Context(), req.Date, req.RecipeID, req.Index)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, e)
}

type planMoveRequest struct {
	Date  *string `json:"date"`
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
	e, err := h.svc.Move(r.Context(), id, req.Date, req.Index)
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
