package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"kondate-supporter/internal/repository"
)

// SeasoningHandler は調味料関連のHTTPエンドポイントを提供する。
type SeasoningHandler struct {
	repo *repository.SeasoningRepository
}

func NewSeasoningHandler(repo *repository.SeasoningRepository) *SeasoningHandler {
	return &SeasoningHandler{repo: repo}
}

type seasoningRequest struct {
	Name           string `json:"name"`
	IsSpoonDisplay bool   `json:"isSpoonDisplay"`
}

func (req seasoningRequest) validate() (name string, isSpoonDisplay bool, err error) {
	name = strings.TrimSpace(req.Name)
	if name == "" {
		return "", false, errors.New("nameは必須です")
	}
	// isSpoonDisplayはtrue/falseどちらも有効な値としてそのまま通す。
	return name, req.IsSpoonDisplay, nil
}

func (h *SeasoningHandler) List(w http.ResponseWriter, r *http.Request) {
	seasonings, err := h.repo.List(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "サーバー内部エラーが発生しました")
		return
	}
	writeJSON(w, http.StatusOK, seasonings)
}

func (h *SeasoningHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req seasoningRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "リクエストの形式が不正です")
		return
	}
	name, isSpoonDisplay, err := req.validate()
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	s, err := h.repo.Create(r.Context(), name, isSpoonDisplay)
	if err != nil {
		h.handleError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, s)
}

func (h *SeasoningHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := parsePathInt64(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "idが不正です")
		return
	}
	s, err := h.repo.Get(r.Context(), id)
	if err != nil {
		h.handleError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, s)
}

func (h *SeasoningHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := parsePathInt64(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "idが不正です")
		return
	}
	var req seasoningRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "リクエストの形式が不正です")
		return
	}
	name, isSpoonDisplay, err := req.validate()
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	s, err := h.repo.Update(r.Context(), id, name, isSpoonDisplay)
	if err != nil {
		h.handleError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, s)
}

func (h *SeasoningHandler) Delete(w http.ResponseWriter, r *http.Request) {
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

func (h *SeasoningHandler) handleError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, repository.ErrNotFound):
		writeError(w, http.StatusNotFound, "調味料が見つかりません")
	case errors.Is(err, repository.ErrDuplicateName):
		writeError(w, http.StatusConflict, "同名の調味料が既に存在します")
	case errors.Is(err, repository.ErrInUse):
		writeError(w, http.StatusConflict, "レシピで使用中の調味料は削除できません")
	default:
		writeError(w, http.StatusInternalServerError, "サーバー内部エラーが発生しました")
	}
}
