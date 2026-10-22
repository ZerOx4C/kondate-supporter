package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
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
	// Tagsは無い・nullのときは空として扱い、タグを全部外す。
	Tags []string `json:"tags"`
}

// importItemRequest は取り込む1件のJSON。title以外は省略・null可。
// cooked_countは整数のリテラルだけを受け付けるため、生のまま受けて自分で読む。
type importItemRequest struct {
	Title       string          `json:"title"`
	Body        string          `json:"body"`
	Tags        []string        `json:"tags"`
	CookedCount json.RawMessage `json:"cooked_count"`
}

var errImportItemFormat = errors.New("形式が不正です")

// maxImportSize は取り込みのボディの上限(5MB)。
const maxImportSize = 5 << 20

// maxImageSize はアップロードできる画像の上限(2MB)。
const maxImageSize = 2 << 20

// recipeResponse はレシピのJSON応答。画像のURLはルーティングを知るhandlerで組み立てる。
type recipeResponse struct {
	model.Recipe
	ImageURL *string `json:"image_url"`
}

func toRecipeResponse(rec model.Recipe) recipeResponse {
	res := recipeResponse{Recipe: rec}
	if rec.HasImage {
		url := fmt.Sprintf("/api/recipes/%d/image?v=%d", rec.ID, rec.ImageVersion)
		res.ImageURL = &url
	}
	return res
}

func (h *RecipeHandler) List(w http.ResponseWriter, r *http.Request) {
	recipes, err := h.svc.List(r.Context())
	if err != nil {
		writeServiceError(w, err)
		return
	}
	res := make([]recipeResponse, len(recipes))
	for i, rec := range recipes {
		res[i] = toRecipeResponse(rec)
	}
	writeJSON(w, http.StatusOK, res)
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
	writeJSON(w, http.StatusOK, toRecipeResponse(rec))
}

func (h *RecipeHandler) Create(w http.ResponseWriter, r *http.Request) {
	req, ok := decodeRecipeRequest(w, r)
	if !ok {
		return
	}
	rec, err := h.svc.Create(r.Context(), req.Name, req.Body, req.Tags)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, toRecipeResponse(rec))
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
	rec, err := h.svc.Update(r.Context(), id, req.Name, req.Body, req.Tags)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toRecipeResponse(rec))
}

// Import はJSON配列のレシピをまとめて登録する。
func (h *RecipeHandler) Import(w http.ResponseWriter, r *http.Request) {
	var raws []json.RawMessage
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxImportSize)).Decode(&raws); err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			writeError(w, http.StatusBadRequest, "リクエストが大きすぎます")
		} else {
			writeError(w, http.StatusBadRequest, "リクエストの形式が不正です")
		}
		return
	}
	if raws == nil {
		writeError(w, http.StatusBadRequest, "リクエストの形式が不正です")
		return
	}
	items := make([]service.ImportItem, len(raws))
	for i, raw := range raws {
		items[i] = decodeImportItem(raw)
	}
	n, err := h.svc.Import(r.Context(), items)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]int{"count": n})
}

// decodeImportItem は取り込む1件を読む。読めなければ理由をErrに入れる。
func decodeImportItem(raw json.RawMessage) service.ImportItem {
	if !bytes.HasPrefix(bytes.TrimSpace(raw), []byte("{")) {
		return service.ImportItem{Err: errImportItemFormat}
	}
	var req importItemRequest
	if err := json.Unmarshal(raw, &req); err != nil {
		return service.ImportItem{Err: errImportItemFormat}
	}
	item := service.ImportItem{Recipe: model.Recipe{Name: req.Title, Body: req.Body, Tags: req.Tags}}
	if cc := bytes.TrimSpace(req.CookedCount); len(cc) > 0 && string(cc) != "null" {
		n, err := strconv.ParseInt(string(cc), 10, 64)
		if err != nil {
			item.Err = service.ErrCookedCountInvalid
		}
		item.Recipe.CookedCount = n
	}
	return item
}

func (h *RecipeHandler) ListTags(w http.ResponseWriter, r *http.Request) {
	tags, err := h.svc.ListTags(r.Context())
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, tags)
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
	h.changeRecipe(w, r, h.svc.IncrementCookedCount)
}

func (h *RecipeHandler) DecrementCooked(w http.ResponseWriter, r *http.Request) {
	h.changeRecipe(w, r, h.svc.DecrementCookedCount)
}

func (h *RecipeHandler) PutBookmark(w http.ResponseWriter, r *http.Request) {
	h.changeRecipe(w, r, h.svc.SetBookmark)
}

func (h *RecipeHandler) DeleteBookmark(w http.ResponseWriter, r *http.Request) {
	h.changeRecipe(w, r, h.svc.DeleteBookmark)
}

// changeRecipe はパスのidのレシピにchangeを適用し、更新後のレシピを200で返す。
func (h *RecipeHandler) changeRecipe(w http.ResponseWriter, r *http.Request, change func(context.Context, int64) (model.Recipe, error)) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	rec, err := change(r.Context(), id)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toRecipeResponse(rec))
}

// PutImage はリクエストボディのJPEGを画像として保存する。
func (h *RecipeHandler) PutImage(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	data, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxImageSize))
	if err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			writeError(w, http.StatusBadRequest, "画像が大きすぎます")
		} else {
			writeError(w, http.StatusBadRequest, "リクエストの形式が不正です")
		}
		return
	}
	if http.DetectContentType(data) != "image/jpeg" {
		writeError(w, http.StatusBadRequest, "JPEG画像を送ってください")
		return
	}
	rec, err := h.svc.SetImage(r.Context(), id, data)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toRecipeResponse(rec))
}

func (h *RecipeHandler) DeleteImage(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	rec, err := h.svc.DeleteImage(r.Context(), id)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toRecipeResponse(rec))
}

// GetImage は画像のバイト列を返す。URLの?v=はブラウザのキャッシュ切り替え用で、値は見ない。
func (h *RecipeHandler) GetImage(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	data, err := h.svc.GetImage(r.Context(), id)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	w.Header().Set("Content-Type", "image/jpeg")
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	w.Header().Set("Content-Length", strconv.Itoa(len(data)))
	w.WriteHeader(http.StatusOK)
	w.Write(data)
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
	var importErr *service.ImportError
	switch {
	case errors.Is(err, service.ErrNameRequired), errors.Is(err, service.ErrImportEmpty):
		writeError(w, http.StatusBadRequest, err.Error())
	case errors.As(err, &importErr):
		writeError(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, service.ErrNotFound), errors.Is(err, service.ErrImageNotFound):
		writeError(w, http.StatusNotFound, err.Error())
	default:
		log.Printf("handler: %v", err)
		writeError(w, http.StatusInternalServerError, "サーバー内部でエラーが発生しました")
	}
}
